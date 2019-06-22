var fs = require('fs');
var path = require('path');
var expect = require('chai').expect;

var synonyms = require('../');
console.log(synonyms);

var input = fs.readFileSync(path.join(__dirname, '/synonyms.txt'), 'UTF-8');

	var withoutExpand = synonyms.parse(input, true, true);

console.log(withoutExpand);