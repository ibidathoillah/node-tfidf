


var fs = require('fs');
var path = require('path');
var expect = require('chai').expect;


var _ = require("underscore")._;
var Tokenizer = require('node-vntokenizer');
var tokenizer = new Tokenizer();


var synonym = require('./solr-synonym');

function readLines(input, func) {
  var remaining = '';

  input.on('data', function(data) {
    remaining += data;
    var index = remaining.indexOf('\n');
    while (index > -1) {
      var line = remaining.substring(0, index);
      remaining = remaining.substring(index + 1);
      func(line);
      index = remaining.indexOf('\n');
    }
  });

  input.on('end', function() {
    if (remaining.length > 0) {
      func(remaining);
    }
  });
}

 _.stopwords  = [];

function func(data) {
   _.stopwords.push(data)
}

var input =  fs.createReadStream('webpage/lib/stopwords.txt');


 readLines(input, func);



var synonyms = require('./solr-synonym');
var input = fs.readFileSync('webpage/lib/synonyms.txt', 'UTF-8');
_.synonymwithoutExpand = synonyms.parse(input, true, true);








var sift = require('sift');

var stringException = [];

var tokenizedDocument = [];

var docSimilarity = require('doc-similarity');




String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

function tokenize(terms)
{


        /**
            
            GATHERING INDIVIDUAL NAME STRING

        **/

        var individualName = [];
        for(i in _.entityData[this.agent_id]) if(_.entityData[  this.agent_id][i].label && _.entityData[  this.agent_id][i].label.toString().split(" ").length > 1) individualName.push(_.entityData[  this.agent_id][i].label.toLowerCase());



        /**
            
            MAKE EXCEPTION TOKENIZER FOR SYNONYM AND INDIVIDUAL NAME

        **/
        Object.keys(_.synonymwithoutExpand).forEach(function(key) {
        		if(key.toString().split(" ").length > 1)
        		stringException.push(key);

        });


                // JIKA ENTITY CASE SENSITIVE
         stringException = _.union(stringException,individualName);

         var stringExceptionRegex= stringException.toString().replaceAll(",", "|");
        //INCASE
      //  stringException = Object.keys(synonymwithoutExpand).toString().replaceAll(",", "|");


        const regex =  RegExp('\\b(?:'+stringExceptionRegex+')\\b|\\w+','g');
        const str = terms.toString().toLowerCase();
        let m;
        terms = [];
        /*
        jika lebih dari satu kata dan mengandung mengandung synomym maka dipush 
        jika tidak mengandung maka masih utuh
        */



  
        	 while ((m = regex.exec(str)) !== null) {

            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
                
            m.forEach((match, groupIndex) => {
        		

               

                if(_.synonymwithoutExpand[match]){
			       match = _.synonymwithoutExpand[match][0];              // SYNONYM DENGAN REPLACE CHARACTER UTAMA
			   	 }
			   	  terms.push(match.toString());
		            	
            });
        }

        

         

        return terms;
}


function buildDocument(text, key,id) {
    var stopOut;

    if (typeof text === 'string') {
        text = tokenize(text.toLowerCase());

        stopOut = true;
    } else if (!_.isArray(text)) {
        stopOut = false;
        return text;
    }

      for(i in text) if(_.synonymwithoutExpand[text[i]]){
         //      console.log(synonymwithoutExpand[terms[i]]);
       // terms = _.union(terms, synonymwithoutExpand[terms[i]])     //SYNONYM DENGAN MELAKUKAN JOIN
       text[i] = _.synonymwithoutExpand[text[i]][0]              // SYNONYM DENGAN REPLACE CHARACTER UTAMA
    }   // JOIN SYNONYM
  


    return text.reduce(function(document, term) {

        if(document.text == undefined) document.text = [];

        if (typeof document[term] === 'function') document[term] = 0;
        if ((!stopOut || _.stopwords.indexOf(term) < 0) && stringException.indexOf(term)==-1)
        {
            term = _.Word.stem(term);
        }


            document[term] = (document[term] ? document[term] + 1 : 1);    //Stemming 
        
            document.text.push(term);
     

        return document;
    }, {
        _id: id,
        path: key
    });
}

function tf(term, document) {
    return document[term] ? document[term] : 0;
}

function documentHasTerm(term, document) {


    return document[term] && document[term] > 0;
}

function TfIdf(deserialized) {
    if (deserialized){
        this.documents = deserialized.documents;
    }
    else{
        this.documents = [];
    }

    this._idfCache = {};

}


// backwards compatibility for < node 0.10
function isEncoding(encoding) {
    if (typeof Buffer.isEncoding !== 'undefined')
        return Buffer.isEncoding(encoding);
    switch ((encoding + '').toLowerCase()) {
        case 'hex':
        case 'utf8':
        case 'utf-8':
        case 'ascii':
        case 'binary':
        case 'base64':
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
        case 'raw':
            return true;
    }
    return false;
}

module.exports = TfIdf;
TfIdf.tf = tf;

TfIdf.prototype.tokenize = tokenize;

TfIdf.prototype.idf = function(term, force) {

    // Lookup the term in the New term-IDF caching,
    // this will cut search times down exponentially on large document sets.
    if (this._idfCache[term] && this._idfCache.hasOwnProperty(term) && force !== true)
        return this._idfCache[term];

    var docsWithTerm = this.documents.reduce(function(count, document) {

        return count + (documentHasTerm(term, document) ? 1 : 0);
    }, 0);

    var idf = 1 + Math.log((this.documents.length) / (1 + docsWithTerm));

    // Add the idf to the term cache and return it
    this._idfCache[term] = idf;
    return idf;
};

// If restoreCache is set to true, all terms idf scores currently cached will be recomputed.
// Otherwise, the cache will just be wiped clean
TfIdf.prototype.addDocument = function(document, key, restoreCache,id,agent_id) {

    this.agent_id = agent_id;


    this.documents.push(buildDocument(document, key,id));

//    console.log(this.documents);

   


    // make sure the cache is invalidated when new documents arrive
    if (restoreCache === true) {
        for (var term in this._idfCache) {
            // invoking idf with the force option set will
            // force a recomputation of the idf, and it will
            // automatically refresh the cache value.
            this.idf(term, true);
        }
    } else {
        this._idfCache = {};
    }
};

// If restoreCache is set to true, all terms idf scores currently cached will be recomputed.
// Otherwise, the cache will just be wiped clean
TfIdf.prototype.addFileSync = function(path, encoding, key, restoreCache) {
    if (!encoding)
        encoding = 'utf8';
    if (!isEncoding(encoding))
        throw new Error('Invalid encoding: ' + encoding);

    var document = fs.readFileSync(path, encoding);
    this.documents.push(buildDocument(document, key));

    // make sure the cache is invalidated when new documents arrive
    if (restoreCache === true) {
        for (var term in this._idfCache) {
            // invoking idf with the force option set will
            // force a recomputation of the idf, and it will
            // automatically refresh the cache value.
            this.idf(term, true);
        }
    } else {
        this._idfCache = {};
    }
};

TfIdf.prototype.tfidf = function(terms, d,options) {
    var _this = this;


    if (!_.isArray(terms))
    {

        terms = tokenize(terms);

    }

    //console.log(this.documents[d])
    

    return terms.reduce(function(value, term) {

        var idf = _this.idf(term);

        idf = idf === Infinity ? 0 : idf;
        return value + (tf(term, _this.documents[d]) * idf);
    }, 0.0);
};



TfIdf.prototype.stopWords = function(text) {

    text = tokenizer.tokenize(text.toLowerCase());

    return text.reduce(function(document, term) {

    
        if (typeof document[term] === 'function') document[term] = 0;
        if (_.stopwords.indexOf(term) < 0)
            document.push(_.Word.stem(term));  // Stemming


        return document;
    }, []);
}




TfIdf.prototype.listTerms = function(d) {
    var terms = [];

    for (var term in this.documents[d]) {
        if (term != '__key')
            terms.push({
                term: term,
                tfidf: this.tfidf(term, d)
            });
    }




    return terms.sort(function(x, y) {
        return y.tfidf - x.tfidf;
    });
};




TfIdf.prototype.tfidfs = function(terms,agent_id,session_id,options, callback) {



  //  this.mydata =  sift(options, this.documents);

    //console.log(this.mydata)

    //console.log(this.mydata.length)

    var tfidfs = new Array(this.documents.length);

    // / console.log("\x1b[32m%s\x1b[0m", "Result : "+terms);


    terms = tokenize(terms);
   

       
    

    for(i in terms){



        var userWord = terms[i];




        
        if(_.synonymwithoutExpand[terms[i]]){
        //      console.log(synonymwithoutExpand[terms[i]]);
           // terms = _.union(terms, synonymwithoutExpand[terms[i]])     //SYNONYM DENGAN MELAKUKAN JOIN

           terms[i] = _.synonymwithoutExpand[terms[i]][0]              // SYNONYM REPLACE DENGAN CHARACTER UTAMA / INDEX KE 0
        }   // JOIN SYNONYM




        // terms[i] = Word.stem(terms[i]); // STEMMING

         var regex = new RegExp(["^", terms[i], "$"].join(""), "i");

         var data = sift({label: regex, _id : {$options: "i" }, $where: function() {

                   this.userWord = userWord;

                   if(this._id.split("#")[1]=="NamedIndividual")
                   {

                          
                      //  console.log(this)
                           //  var split = data.type; for(x in split) _[_.agent]["entity"]["@"+split[x]] = data;  //  STORE VARIBALE TO GLOBAL
                           for(x in this._types)
                           {
                                    _[agent_id][session_id]["entity"][this._types[x]] = this;  //  STORE VARIBALE TO GLOBAL
                           }

                        

                              
                        
                   }
                   else
                   {
                        
                           for(x in this._subClassOf)
                           {
                                    _[agent_id][session_id]["entity"][this._subClassOf[x]] = this;  //  STORE VARIBALE TO GLOBAL
                           }

                           
                   }

                return true
            }
                },_.entityData[agent_id])[0];  // GET ENTITY DETAIL eg. @People = { Agus Rifai }



            if(_.stopwords.indexOf(terms[i]) < 0)
            terms[i] = _.Word.stem(terms[i])
            else
            terms[i] = null




      
    }

   // console.log( _[agent_id][session_id]["entity"]);





    var newText = terms.join(" ");

    for (var i = 0; (i < this.documents.length); i++) {
        tfidfs[i] = this.tfidf(terms, i,options);


      if(!this.documents[i].text)
        this.documents[i].text= [];

        if (callback){
            callback(i, tfidfs[i],docSimilarity.wordFrequencySim(newText, this.documents[i].text.join(" "), docSimilarity.cosineSim), this.documents[i].__key);
        }
    }

    return tfidfs;
};

// Define a tokenizer other than the default "WordTokenizer"
TfIdf.prototype.setTokenizer = function(t) {
    if (!_.isFunction(t.tokenize))
        throw new Error('Expected a valid Tokenizer');
    tokenizer = t;
};
