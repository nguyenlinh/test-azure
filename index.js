var docx4js = require('docx4js');

function isIgnoredType(type) {
  const ignoreTypes = ['proofErr', 'bookmarkStart', 'bookmarkEnd'];
  return ignoreTypes.includes(type);
}

function parseHyperlink(hyperlink) {
  const children = hyperlink.children
    .filter((child) => !isIgnoredType(child.type))
  const link = children.reduce((link, t) => {
    return t.children.reduce((link, child) => {
      return link + child.children.join('')
    }, link)
  }, '');
  return {
    type: 'hyperlink',
    content: link,
  };
}

function parsePstyle(pStyle) {
  return {
    style: pStyle.attribs['w:val'],
  }
}

function parseShd(shd) {
  return {
    bg:shd.attribs['w:fill'],
  }
}

function parsePpR(p) {
  if (p.props.pr) {
    return p.props.pr.children.map((tag) => {
      if (tag.name === 'w:pStyle') {
        return parsePstyle(tag);
      } else if (tag.name === 'w:shd') {
        return parseShd(tag);
      } else if (tag.name === 'w:rPr') {
        // TODO: parsa 'w:rPr' för att få bold och italic
      } else {
        console.log(`${tag.name} is not parsed (parsePpR)`);
      }
    }).filter((tag) => !!tag);
  }
  return [];
}

function parseRpR(r) {
  if (r.props.pr) {
    return r.props.pr.children.map((tag) => {
      if (tag.name === 'w:b') {
        return {style: 'bold'};
      } else if (tag.name === 'w:i') {
        return {style: 'italic'};
      } else {
        console.log(`${tag.name} is not parsed (parseRpR)`);
      }
    }).filter((tag) => !!tag);
  }
  return [];
}

function parseR(r) {
  const children = r.children.filter((child) => !isIgnoredType(child.type));
  const styles = parseRpR(r);
  return {
    type: 'text',
    styles,
    content: children.reduce((acc, child) => acc + child.children.join(''), ''),
  }
}

function parseP(p) {
  const children = p.children.filter((child) => !isIgnoredType(child.type));
  const styles = parsePpR(p);
  const content = children.map((child) => {
    if (child.type === 'r') {
      return parseR(child);
    } else if (child.type === 'hyperlink') {
      return parseHyperlink(child);
    } else {
      console.warn(`${child.type} is not parsed (parseP)`);
    }
    return {}; // TODO: uppdatera om det finns mer att parsa ut
  });
  return {
    type: 'paragraph',
    styles,
    content,
  };
}

function parseList(list) {
  return {
    type: 'list',
  }
}

function parseTable(table) {
  return {
    type: 'table',
  }
}

function parseHeading(obj) {
  const rObjects = obj.children
    .filter((child) => child.type === 'r');
  return rObjects.reduce((acc, r) => {
    return acc + r.children.reduce((acc, t) => acc + t.children.join(''), '');
  }, '');
}

function createHeading(obj) {
  const content = parseHeading(obj);
  return {
    type: 'heading',
    level: obj.props.outline,
    content,
  };
}

function createPageData(obj) {
  return {
    type: 'page',
    content: [createHeading(obj)],
  };
}

var json = [{
  type: 'page',
  content: [
    {
      type: 'heading',
      level:1,
      content: 'my heading 1'
    },
    {
      type: 'paragraph',
      content: [{
        styles: [],
        texts: [{
          styles: [],
          value: '',
        }],
      }]
    },
    {
      type: 'heading',
      level:2,
      content: 'my heading'
    },
    {
      type: 'paragraph',
      content: [],
    },
    {
      type: 'table',
      content: {},
    },
    {
      type: 'list',
      content: [],
    },
  ],
}];

function isNewHeading1(obj) {
  return obj.type === 'heading' && obj.props.outline === 1;
}

function addToCurrentPage(dataObj) {
  const currentPage = parsedObjects[parsedObjects.length - 1];
  currentPage.content.push(dataObj);
}

function parseDoc(doc) {
  var foundFirstHeading = false; // Strunta i allt innan en h1 har hittats
  const parsedObjects = [];
  let currentPage = null;
  doc
    .filter((obj) => {
      if (isNewHeading1(obj) || foundFirstHeading) {
        foundFirstHeading = true;
      }
      return foundFirstHeading;
    })
    .forEach((obj) => {
      if (isNewHeading1(obj)) {
        const pageData = createPageData(obj);
        currentPage = pageData;
        parsedObjects.push(currentPage);
      } else if (foundFirstHeading) {
        if (obj.type === 'p') {
          currentPage.content.push(parseP(obj));
        } else if (obj.type === 'heading') {
          currentPage.content.push(createHeading(obj));
        } else if (obj.type === 'list') {
          currentPage.content.push(parseList(obj));
        } else if (obj.type === 'tbl') {
          currentPage.content.push(parseTable(obj));
        } else {
          console.warn(`Unknown type ${obj.type}`);
        }
      }
  });
  return parsedObjects;
}
/*
function print(parsedObj) {
  parsedObjects.forEach((parsedObj) => {
    console.log("===========================")
    parsedObj.content.forEach((p) => console.log(p));
    console.log("===========================")
  })
} 
*/
function load(file, res) {
  docx4js.load(file).then(docx => {
    var data = docx.render(function createElement(type,props,children) {
      return type === isIgnoredType(type) ? null : {type,props,children};
    })
    var doc = data.children[0].children
      .filter((child) => !!child)
      .filter((child) => !isIgnoredType(child.type));
    const parsedObjects = parseDoc(doc);
    res.send(JSON.stringify(parsedObjects));
  });
}

const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
var path = require('path');

// default options
app.use(fileUpload({
  useTempFiles : true,
  tempFileDir : process.env.TMPDIR
}));

app.post('/upload', function(req, res) {
  if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
  }

  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  const sampleFile = req.files.sampleFile;
  load(sampleFile.tempFilePath, res);
  // res.sendFile(path.join(__dirname + '/index.html'))

});

app.get('/', (req, res) => res.sendFile(path.join(__dirname + '/index.html')));
app.listen(8080)
