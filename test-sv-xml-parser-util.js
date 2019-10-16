function isHeading1(element) {
	var pPrs = element.getElements('w:pPr').iterator();
   if (pPrs.hasNext()) {
      var pPr = pPrs.next();
		var pStyles = pPr.getElements('w:pStyle').iterator();
      if (pStyles.hasNext()) {
         var pStyle = pStyles.next();
			var val = pStyle.getAttribute('w:val');
         return val === 'Heading1';
      }
   }
   return false;
}

function isR(element) {
	var rs = element.getElements('w:r').iterator();
   return rs.hasNext();
}

function getR(element) {
	var rs = element.getElements('w:r').iterator();
   if (rs.hasNext()) {
      var r = rs.next();
		var ts = r.getElements('w:t').iterator();
      if (ts.hasNext()) {
         var t = ts.next();
			return t.getText();
      }
   }
   return '';
}


function parseXml() {
	var parser = require('XmlParserUtil');
   var foundFirstHeading1 = false;
   parser.parse('/pkg:package/pkg:part/pkg:xmlData/w:document/w:body/w:p', scriptVariables.xml, 'UTF-8', function(element) {
		if (isHeading1(element)) {
         foundFirstHeading1 = true;
      }
      if (foundFirstHeading1) {
         if (isR(element)) {
            out.println(getR(element) + '<br>');
         }
      }
   });
}

parseXml();
