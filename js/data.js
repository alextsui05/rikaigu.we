/*
	Rikaigu
	Extended by Versus Void

	--

	Rikaikun
	Copyright (C) 2010-2017 Erek Speed
	https://github.com/melink14/rikaikun

	---

	Originally based on Rikaichan 1.07
	by Jonathan Zarate
	http://www.polarcloud.com/

	---

	Originally based on RikaiXUL 0.4 by Todd Rudick
	http://www.rikai.com/
	http://rikaixul.mozdev.org/

	---

	This program is free software; you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation; either version 2 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program; if not, write to the Free Software
	Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA

	---

	Please do not change or remove any of the copyrights or links to web pages
	when modifying any of the files. - Jon

*/

function rcxDict() {
}

rcxDict.prototype = {
	config: {},

	setConfig: function(c) {
		this.config = c;
	},

	loadDictionaries: function() {
		return Promise.all([
			this.loadDictionary(),
			this.loadNames(),
			this.loadDIF()
		]);
	},

	fileRead: function(filename, field) {
		var self = this;
		return new Promise(function(resolve, reject) {
			var req = new XMLHttpRequest();
			req.onreadystatechange = function() {
				if (this.readyState !== XMLHttpRequest.DONE) {
					return;
				}
				if (this.status !== 200) {
					console.error("Can't load", filename);
					reject("sorry");
					return;
				}
				if (field) {
					self[field] = this.responseText;
					resolve(true);
				} else {
					resolve(this.responseText);
				}
			};
			req.open("GET", chrome.extension.getURL(filename));
			req.send(null);
		});
	},

	fileReadArray: function(name, field) {
		var self = this;
		return this.fileRead(name)
			.then(this.parseArray)
			.then(function(array) {
				if (field) {
					self[field] = array;
					return true;
				} else {
					return array;
				}
			});
	},

	parseArray: function(fileContent) {
		var lines = fileContent.split('\n');
		var i = 0;
		while (i < lines.length) {
			// Strip any blank and comment lines
			if (lines[i].length === 0 || lines[i][0] === '#') {
				lines.splice(i, 1);
			} else {
				i += 1;
			}
		}
		return lines;
	},

	find: function(data, text) {
		const tlen = text.length;
		var beg = 0;
		var end = data.length - 1;
		var i;
		var mi;
		var mis;

		while (beg < end) {
			mi = (beg + end) >> 1;
			i = data.lastIndexOf('\n', mi) + 1;

			mis = data.substr(i, tlen);
			if (text < mis) end = i - 1;
			else if (text > mis) beg = data.indexOf('\n', mi + 1) + 1;
			else return data.substring(i, data.indexOf('\n', mi + 1));
		}
		return null;
	},

	loadNames: function() {
		return Promise.all([
			this.fileRead("data/names.dat", "nameDict"),
			this.fileRead("data/names.idx", "nameIndex")
		]);
	},

	// Note: These are flat text files; loaded as one continous string to reduce memory use
	loadDictionary: function() {
		return Promise.all([
			this.fileRead("data/dict.dat", "wordDict"),
			this.fileRead("data/dict.idx", "wordIndex"),
			this.fileRead("data/kanji.dat", "kanjiData"),
			this.fileReadArray("data/radicals.dat", "radData")
		]);
	},

	inflectionTypes: {
		__next__: 1,
		__any__: 0
	},
	inflectionTypeToInt: function(type_str) {
		var types = type_str.split('|');
		var type_int = 0;
		types.forEach(function(type) {
			if (!(type in this.inflectionTypes)) {
				var type_bit = this.inflectionTypes.__next__;
				this.inflectionTypes.__next__ = (this.inflectionTypes.__next__ << 1);
				this.inflectionTypes.__any__ = (this.inflectionTypes.__any__ | type_bit);
				this.inflectionTypes[type] = type_bit;
			}
			type_int = (type_int | this.inflectionTypes[type]);
		}, this);
		return type_int;
	},
	loadDIF: function() {
		return this.fileReadArray("data/deinflect.dat").then(this.parseDIF.bind(this));
	},

	parseDIF: function(buffer) {
		this.difRules = [];
		var prevLen = -1;
		var g, o;

		for (var i = 0; i < buffer.length; ++i) {
			var f = buffer[i].split('\t');
			if (f.length !== 5) {
				console.error('Invalid line in `deinflect.dat`:', buffer[i]);
				continue;
			}
			o = {};
			o.from = f[0];
			o.to = f[1];
			o.source_type = this.inflectionTypeToInt(f[2]);
			o.dest_type = this.inflectionTypeToInt(f[3]);
			o.reason = f[4];

			if (prevLen != o.from.length) {
				prevLen = o.from.length;
				g = {};
				g.flen = prevLen;
				this.difRules.push(g);
			}
			if (!(o.from in g)) {
				g[o.from] = [];
			}
			g[o.from].push(o);
		}
		return true;
	},

	deinflect: function(word) {
		var r = [];
		var have = [];
		var o;

		o = {};
		o.word = word;
		// Original word can have any type
		o.type = this.inflectionTypes.__any__;
		o.reason = '';
		r.push(o);
		have[word] = 0;

		var i, j, k;

		i = 0;
		do {
			word = r[i].word;
			var wordLen = word.length;
			var type = r[i].type;

			for (j = 0; j < this.difRules.length; ++j) {
				var g = this.difRules[j];
				if (g.flen <= wordLen) {
					var end = word.substr(-g.flen);
					if (!(end in g)) continue;
					var rules = g[end];
					for (k = 0; k < rules.length; ++k) {
						var rule = rules[k];
						if (type & rule.source_type) { // If rule is applicable to this word
							var newWord = word.substr(0, word.length - rule.from.length) + rule.to;
							if (newWord.length <= 1) continue;
							o = {};
							if (have[newWord] != undefined) {
								o = r[have[newWord]];
								// If we have already obtained this new word through other
								// chain of deinflections - update only it's type.
								// We union types to denote it can have any of these types
								o.type = (o.type | rule.dest_type);
								continue;
							}
							have[newWord] = r.length;
							if (r[i].reason.length) o.reason = rule.reason + ' &lt; ' + r[i].reason;
							else o.reason = rule.reason;
							// We know exact type of deinflected word -
							// it is specified by the rule we just applied
							o.type = rule.dest_type;
							o.word = newWord;
							r.push(o);
						}
					}
				}
			}

		} while (++i < r.length);

		return r;
	},


	// Katakana -> hiragana conversion tables
	ch: [0x3092, 0x3041, 0x3043, 0x3045, 0x3047, 0x3049, 0x3083, 0x3085, 0x3087, 0x3063, 0x30FC, 0x3042, 0x3044, 0x3046,
		0x3048, 0x304A, 0x304B, 0x304D, 0x304F, 0x3051, 0x3053, 0x3055, 0x3057, 0x3059, 0x305B, 0x305D, 0x305F, 0x3061,
		0x3064, 0x3066, 0x3068, 0x306A, 0x306B, 0x306C, 0x306D, 0x306E, 0x306F, 0x3072, 0x3075, 0x3078, 0x307B, 0x307E,
		0x307F, 0x3080, 0x3081, 0x3082, 0x3084, 0x3086, 0x3088, 0x3089, 0x308A, 0x308B, 0x308C, 0x308D, 0x308F, 0x3093
	],
	cv: [0x30F4, 0xFF74, 0xFF75, 0x304C, 0x304E, 0x3050, 0x3052, 0x3054, 0x3056, 0x3058, 0x305A, 0x305C, 0x305E, 0x3060,
		0x3062, 0x3065, 0x3067, 0x3069, 0xFF85, 0xFF86, 0xFF87, 0xFF88, 0xFF89, 0x3070, 0x3073, 0x3076, 0x3079, 0x307C
	],
	cs: [0x3071, 0x3074, 0x3077, 0x307A, 0x307D],

	wordSearch: function(word, doNames, max) {
		var i, u, v, r, p;
		var trueLen = [0];
		var entry = {};

		// Half & full-width katakana to hiragana conversion.
		// Note: katakana `vu` is never converted to hiragana

		p = 0;
		r = '';
		for (i = 0; i < word.length; ++i) {
			u = v = word.charCodeAt(i);

			if (u <= 0x3000) break;

			// Full-width katakana to hiragana
			if ((u >= 0x30A1) && (u <= 0x30F3)) {
				u -= 0x60;
			}
			// Half-width katakana to hiragana
			else if ((u >= 0xFF66) && (u <= 0xFF9D)) {
				u = this.ch[u - 0xFF66];
			}
			// Voiced (used in half-width katakana) to hiragana
			else if (u == 0xFF9E) {
				if ((p >= 0xFF73) && (p <= 0xFF8E)) {
					r = r.substr(0, r.length - 1);
					u = this.cv[p - 0xFF73];
				}
			}
			// Semi-voiced (used in half-width katakana) to hiragana
			else if (u == 0xFF9F) {
				if ((p >= 0xFF8A) && (p <= 0xFF8E)) {
					r = r.substr(0, r.length - 1);
					u = this.cs[p - 0xFF8A];
				}
			}
			// Ignore J~
			else if (u == 0xFF5E) {
				p = 0;
				continue;
			}

			r += String.fromCharCode(u);
			trueLen[r.length] = i + 1; // Need to keep real length because of the half-width semi/voiced conversion
			p = v;
		}
		word = r;


		var dict;
		var index;
		var maxTrim;
		var cache = [];
		var have = [];
		var count = 0;
		var maxLen = 0;

		if (doNames) {
			dict = this.nameDict;
			index = this.nameIndex;
			maxTrim = 20;
			entry.names = 1;
			console.log('doNames');
		} else {
			dict = this.wordDict;
			index = this.wordIndex;
			maxTrim = 7;
		}

		if (max != null) maxTrim = max;

		entry.data = [];

		while (word.length > 0) {
			var showInf = (count != 0);
			var trys;

			if (doNames) trys = [{
				'word': word,
				'type': this.inflectionTypes.__any__,
				'reason': null
			}];
			else trys = this.deinflect(word);

			for (i = 0; i < trys.length; i++) {
				u = trys[i];

				var ix = cache[u.word];
				if (!ix) {
					ix = this.find(index, u.word + ',');
					if (!ix) {
						cache[u.word] = [];
						continue;
					}
					ix = ix.split(',');
					cache[u.word] = ix;
				}

				for (var j = 1; j < ix.length; ++j) {
					var ofs = ix[j];
					if (have[ofs]) continue;

					var dentry = dict.substring(ofs, dict.indexOf('\n', ofs));

					var ok = true;
					if (i > 0) {
						// > 0 a de-inflected word

						// dentry now is like:
						// /(io) (v5r) to finish/to close/
						// /(v5r) to finish/to close/(P)/
						// /(aux-v,v1) to begin to/(P)/
						// /(adj-na,exp,int) thank you/many thanks/
						// /(adj-i) shrill/

						var w;
						var x = dentry.split(/[,()]/);
						var y = u.type;
						var z = x.length - 1;
						if (z > 10) z = 10;
						for (; z >= 0; --z) {
							w = x[z];
							// If the word was deinflected, we have to make sure
							// obtained result is consistent with candidate
							// dictionary entry
							if ((y & this.inflectionTypes['v1']) && w.startsWith('v1')) break;
							if ((y & this.inflectionTypes['adj-i']) && w == 'adj-i') break;
							if ((y & this.inflectionTypes['v5']) && w.startsWith('v5')) break;
							if ((y & this.inflectionTypes['vs']) && w.startsWith('vs-')) break;
							if ((y & this.inflectionTypes['vk']) && w == 'vk') break;
						}
						ok = (z != -1);
					}
					if (ok) {
						// TODO confugirable number of entries
						if (count >= 5) {
							entry.more = 1;
							if (doNames) break;
						}

						have[ofs] = 1;
						++count;
						if (maxLen == 0) maxLen = trueLen[word.length];

						if (trys[i].reason) {
							if (showInf) r = '&lt;&nbsp;' + trys[i].reason + ' &lt;&nbsp;' + word;
							else r = '&lt;&nbsp;' + trys[i].reason;
						} else {
							r = null;
						}

						entry.data.push([dentry, r, word.length]);
					}
				} // for j < ix.length
				if (count >= maxTrim) break;
			} // for i < trys.length
			if (count >= maxTrim || count >= 5) break;
			word = word.substr(0, word.length - 1);
		} // while word.length > 0

		if (!doNames) {
			// Sort by match length and then by commonness
			entry.data.sort(function(a, b) {
				var d = a[2] - b[2];
				if (d !== 0) return -d;
				var aFreq = parseInt(a[0].substring(a[0].lastIndexOf('/') + 1, a[0].length)) || 1e9;
				var bFreq = parseInt(b[0].substring(b[0].lastIndexOf('/') + 1, b[0].length)) || 1e9;
				return aFreq - bFreq;
			});
			entry.data.splice(5);
		}

		if (entry.data.length == 0) return null;

		entry.matchLen = maxLen;
		return entry;
	},

	translate: function(text) {
		var e, o;
		var skip;

		o = {};
		o.data = [];
		o.textLen = text.length;

		while (text.length > 0) {
			e = this.wordSearch(text, false, 1);
			if (e != null) {
				if (o.data.length >= 7) {
					o.more = 1;
					break;
				}
				o.data.push(e.data[0]);
				skip = e.matchLen;
			} else {
				skip = 1;
			}
			text = text.substr(skip, text.length - skip);
		}

		if (o.data.length == 0) {
			return null;
		}

		o.textLen -= text.length;
		return o;
	},

	bruteSearch: function(text, doNames) {
		var r, e, d, i, j;
		var wb, we;
		var max;

		r = 1;
		if (text.charAt(0) == ':') {
			text = text.substr(1, text.length - 1);
			if (text.charAt(0) != ':') r = 0;
		}
		if (r) {
			if (text.search(/[\u3000-\uFFFF]/) != -1) {
				wb = we = '[\\s\\[\\]]';
			} else {
				wb = '[\\)/]\\s*';
				we = '\\s*[/\\(]';
			}
			if (text.charAt(0) == '*') {
				text = text.substr(1, text.length - 1);
				wb = '';
			}
			if (text.charAt(text.length - 1) == '*') {
				text = text.substr(0, text.length - 1);
				we = '';
			}
			text = wb + text.replace(/[\[\\\^\$\.\|\?\*\+\(\)]/g, function(c) {
				return '\\' + c;
			}) + we;
		}

		e = {
			data: [],
			reason: [],
			kanji: 0,
			more: 0
		};

		if (doNames) {
			e.names = 1;
			max = 20;
			d = this.nameDict;
		} else {
			e.names = 0;
			max = 7;
			d = this.wordDict;
		}

		r = new RegExp(text, 'igm');
		while (r.test(d)) {
			if (e.data.length >= max) {
				e.more = 1;
				break;
			}
			j = d.indexOf('\n', r.lastIndex);
			e.data.push([d.substring(d.lastIndexOf('\n', r.lastIndex - 1) + 1, j), null]);
			r.lastIndex = j + 1;
		}

		return e.data.length ? e : null;
	},

	kanjiSearch: function(kanji) {
		console.log(kanji);
		const hex = '0123456789ABCDEF';
		var kde;
		var entry;
		var a, b;
		var i;

		i = kanji.charCodeAt(0);
		if (i < 0x3000) return null;

		kde = this.find(this.kanjiData, kanji);
		if (!kde) return null;

		a = kde.split('|');
		if (a.length != 6) return null;

		entry = {};
		entry.kanji = a[0];

		entry.misc = {};
		entry.misc['U'] = hex[(i >>> 12) & 15] + hex[(i >>> 8) & 15] + hex[(i >>> 4) & 15] + hex[i & 15];

		b = a[1].split(' ');
		for (i = 0; i < b.length; ++i) {
			if (b[i].match(/^([A-Z]+)(.*)/)) {
				if (!entry.misc[RegExp.$1]) entry.misc[RegExp.$1] = RegExp.$2;
				else entry.misc[RegExp.$1] += ' ' + RegExp.$2;
			}
		}

		entry.onkun = a[2].replace(/\s+/g, '\u3001 ');
		entry.nanori = a[3].replace(/\s+/g, '\u3001 ');
		entry.bushumei = a[4].replace(/\s+/g, '\u3001 ');
		entry.eigo = a[5];

		return entry;
	},

	numList: [
		'H', 'Halpern',
		'L', 'Heisig',
		'E', 'Henshall',
		'DK', 'Kanji Learners Dictionary',
		'N', 'Nelson',
		'V', 'New Nelson',
		'Y', 'PinYin',
		'P', 'Skip Pattern',
		'IN', 'Tuttle Kanji &amp; Kana',
		'I', 'Tuttle Kanji Dictionary',
		'U', 'Unicode'
	],

	namesClassificationCodes: {
		's': 'surname',
		'p': 'place',
		'u': 'person name (given or surname)',
		'g': 'given name',
		'f': 'female given name',
		'm': 'male given name',
		'h': 'full name of a particular person',
		'pr': 'product name',
		'c': 'company name',
		'o': 'organization name',
		'st': 'station',
		'wk': 'work of literature, art, film, etc'
	},
	expandClassificationCode: function(code) {
		return rcxDict.prototype.namesClassificationCodes[code] || code;
	},
	classificationCodesRegexp: /\((s|p|u|g|f|m|h|pr|c|o|st|wk)(,(s|p|u|g|f|m|h|pr|c|o|st|wk))*\)/g,
	classificationCodesReplacer: function(match) {
		var codes = match.substring(1, match.length - 1).split(',');
		return '(' + codes.map(rcxDict.prototype.expandClassificationCode).join('; ') + ')';
	},

	makeHtml: function(entry) {
		var e;
		var b;
		var c, s, t;
		var i, j, n;

		if (entry == null) return '';

		b = [];

		if (entry.kanji) {
			var yomi;
			var box;
			var bn;
			var k;
			var nums;

			yomi = entry.onkun.replace(/\.([^\u3001]+)/g, '<span class="k-yomi-hi">$1</span>');
			if (entry.nanori.length) {
				yomi += '<br/><span class="k-yomi-ti">\u540d\u4e57\u308a</span> ' + entry.nanori;
			}
			if (entry.bushumei.length) {
				yomi += '<br/><span class="k-yomi-ti">\u90e8\u9996\u540d</span> ' + entry.bushumei;
			}

			bn = entry.misc['B'] - 1;
			k = entry.misc['G'];
			switch (k) {
				case 8:
					k = 'general<br/>use';
					break;
				case 9:
					k = 'name<br/>use';
					break;
				default:
					k = isNaN(k) ? '-' : ('grade<br/>' + k);
					break;
			}
			box = '<table class="k-abox-tb"><tr>' +
				'<td class="k-abox-r">radical<br/>' + this.radData[bn].charAt(0) + ' ' + (bn + 1) + '</td>' +
				'<td class="k-abox-g">' + k + '</td>' +
				'</tr><tr>' +
				'<td class="k-abox-f">freq<br/>' + (entry.misc['F'] ? entry.misc['F'] : '-') + '</td>' +
				'<td class="k-abox-s">strokes<br/>' + entry.misc['S'] + '</td>' +
				'</tr></table>';
			if (rcxMain.config.kanjicomponents == 'true') {
				k = this.radData[bn].split('\t');
				box += '<table class="k-bbox-tb">' +
					'<tr><td class="k-bbox-1a">' + k[0] + '</td>' +
					'<td class="k-bbox-1b">' + k[2] + '</td>' +
					'<td class="k-bbox-1b">' + k[3] + '</td></tr>';
				j = 1;
				for (i = 0; i < this.radData.length; ++i) {
					s = this.radData[i];
					if ((bn != i) && (s.indexOf(entry.kanji) != -1)) {
						k = s.split('\t');
						c = ' class="k-bbox-' + (j ^= 1);
						box += '<tr><td' + c + 'a">' + k[0] + '</td>' +
							'<td' + c + 'b">' + k[2] + '</td>' +
							'<td' + c + 'b">' + k[3] + '</td></tr>';
					}
				}
				box += '</table>';
			}

			nums = '';
			j = 0;

			kanjiinfo = rcxMain.config.kanjiinfo;
			for (i = 0; i * 2 < this.numList.length; i++) {
				c = this.numList[i * 2];
				if (kanjiinfo[i] == 'true') {
					s = entry.misc[c];
					c = ' class="k-mix-td' + (j ^= 1) + '"';
					nums += '<tr><td' + c + '>' + this.numList[i * 2 + 1] + '</td><td' + c + '>' + (s ? s : '-') + '</td></tr>';
				}
			}
			if (nums.length) nums = '<table class="k-mix-tb">' + nums + '</table>';

			b.push('<table class="k-main-tb"><tr><td valign="top">');
			b.push(box);
			b.push('<span class="k-kanji">' + entry.kanji + '</span><br/>');
			b.push('<div class="k-eigo">' + entry.eigo + '</div>');
			b.push('<div class="k-yomi">' + yomi + '</div>');
			b.push('</td></tr><tr><td>' + nums + '</td></tr></table>');
			return b.join('');
		}

		s = t = '';

		if (entry.names) {
			c = [];

			b.push('<div class="w-title">Names Dictionary</div><table class="w-na-tb"><tr><td>');
			for (i = 0; i < entry.data.length; ++i) {
				e = entry.data[i][0].match(/^(.+?)\s+(?:\[(.*?)\])?\s*\/(.+)\//);
				if (!e) continue;

				// The next two lines re-process the entries that contain separate
				// search key and spelling due to mixed hiragana/katakana spelling
				e3 = e[3].match(/^(.+?)\s+(?:\[(.*?)\])?\s*\/(.+)\//);
				if (e3) e = e3;

				if (s != e[3]) {
					c.push(t);
					t = '';
				}

				if (e[2]) c.push('<span class="w-kanji">' + e[1] + '</span> &#32; <span class="w-kana">' + e[2] + '</span><br/> ');
				else c.push('<span class="w-kana">' + e[1] + '</span><br/> ');

				s = e[3];
				s = s.replace(/\//g, '; ').replace(this.classificationCodesRegexp, this.classificationCodesReplacer);

				t = '<span class="w-def">' + s + '</span><br/>';
			}
			c.push(t);
			if (c.length > 4) {
				n = (c.length >> 1) + 1;
				b.push(c.slice(0, n + 1).join(''));

				t = c[n];
				c = c.slice(n, c.length);
				for (i = 0; i < c.length; ++i) {
					if (c[i].indexOf('w-def') != -1) {
						if (t != c[i]) b.push(c[i]);
						if (i == 0) c.shift();
						break;
					}
				}

				b.push('</td><td>');
				b.push(c.join(''));
			} else {
				b.push(c.join(''));
			}
			if (entry.more) b.push('...<br/>');
			b.push('</td></tr></table>');
		} else {
			if (entry.title) {
				b.push('<div class="w-title">' + entry.title + '</div>');
			}

			var pK = '';
			var k;

			for (i = 0; i < entry.data.length; ++i) {
				e = entry.data[i][0].match(/^(.+?)\s+(?:\[(.*?)\])?\s*\/(.+)/);
				if (!e) continue;

				var conj = '';
				if (entry.data[i][1]) conj = ' <span class="w-conj">(' + entry.data[i][1] + ')</span>';
				/*
				 * e[1] = kanji/kana
				 * e[2] = kana
				 * e[3] = definition
				 */
				var ws_groups = e[1].split(';');
				var readings = e[2] && e[2].split(';');
				if (readings) {
					// Array of indexes of all readings
					var all = [];
					for (var j = 0; j < readings.length; ++j) {
						var parts = readings[j].split('|');
						all.push(j);
						readings[j] = {
							reading: parts[0],
							// The only marker for reading is `U` - uncommonnes
							uncommon: parts.length > 1
						};
					}

					for (var j = 0; j < ws_groups.length; ++j) {
						var parts = ws_groups[j].split('#');
						var ws = parts[0].split(',');
						// If writing have no specified readings, it means
						// it admit any reading
						var current_readings = all;
						if (parts.length > 1) {
							current_readings = parts[1].split(',').map(function(i) { return parseInt(i); });
						}
						for (var l = 0; l < ws.length; ++l) {
							var w = ws[l];
							if (l > 0) {
								b.push('\u3001');
							}
							b.push('<span class="w-kanji')
							if (w.endsWith('|U')) {
								b.push(' uncommon');
								w = w.substring(0, w.length - 2);
							}
							b.push('">');
							b.push(w);
							b.push('</span>');
						}
						b.push('<span class="spacer"></span>&#32;');

						for (var l = 0; l < current_readings.length; ++l) {
							var reading = readings[current_readings[l]];
							if (l > 0) {
								b.push('\u3001');
							}
							b.push('<span class="w-kana');
							if (reading.uncommon) {
								b.push(' uncommon');
							}
							b.push('">' + reading.reading + '</span>');
						}
						if (j === 0) {
							b.push(conj);
						}
						b.push('<br />');
					}
				} else {
					for (var j = 0; j < ws_groups.length; ++j) {
						var w = ws_groups[j].split('|');
						if (j > 0) {
							b.push('\u3001');
						}
						b.push('<span class="w-kana')
						if (w.length > 1 && w[1] === 'U') {
							b.push(' uncommon');
						}
						b.push('">' + w[0] + '</span>');
						b.push(conj);
					}
					b.push('<br />');
				}

				if (rcxMain.config.onlyreading === 'false') {
					s = e[3];
					s = s.substring(0, s.lastIndexOf('/'));
					t = s.replace(/[ \/](\(\d+\))/g, '<br />$1').replace(/\//g, '; ');
					b.push('<span class="w-def">' + t + '</span><br/>');
				} else if (i + 1 < entry.data.length) {
					b.push('<hr>');
				}
			}
			if (entry.more) b.push('...<br/>');
			if (rcxMain.config.onlyreading === 'true') {
					b.splice(0, 0, '<span class="note">`D` - show definitions</span><div class="clearfix"></div>');
			}
		}

		return b.join('');
	},


	makeHtmlForRuby: function(entry) {
		var e;
		var b;
		var c, s, t;
		var i, j, n;

		if (entry == null) return '';

		b = [];

		s = t = '';

		if (entry.title) {
			b.push('<div class="w-title">' + entry.title + '</div>');
		}

		for (i = 0; i < entry.data.length; ++i) {
			e = entry.data[i][0].match(/^(.+?)\s+(?:\[(.*?)\])?\s*\/(.+)\//);
			if (!e) continue;

			s = e[3];
			t = s.replace(/\//g, '; ');
			t = '<span class="w-def">' + t + '</span><br/>\n';
		}
		b.push(t);

		return b.join('');
	},

	makeText: function(entry, max) {
		var e;
		var b;
		var i, j;
		var t;

		if (entry == null) return '';

		b = [];

		if (entry.kanji) {
			b.push(entry.kanji + '\n');
			b.push((entry.eigo.length ? entry.eigo : '-') + '\n');

			b.push(entry.onkun.replace(/\.([^\u3001]+)/g, '（$1）') + '\n');
			if (entry.nanori.length) {
				b.push('名乗り\t' + entry.nanori + '\n');
			}
			if (entry.bushumei.length) {
				b.push('部首名\t' + entry.bushumei + '\n');
			}

			for (i = 0; i < this.numList.length; i += 2) {
				e = this.numList[i];
				j = entry.misc[e];
				b.push(this.numList[i + 1].replace('&amp;', '&') + '\t' + (j ? j : '-') + '\n');
			}
		} else {
			if (max > entry.data.length) max = entry.data.length;
			for (i = 0; i < max; ++i) {
				e = entry.data[i][0].match(/^(.+?)\s+(?:\[(.*?)\])?\s*\/(.+)\//);
				if (!e) continue;

				if (e[2]) {
					b.push(e[1] + '\t' + e[2]);
				} else {
					b.push(e[1]);
				}

				t = e[3].replace(/\//g, '; ');
				b.push('\t' + t + '\n');
			}
		}
		return b.join('');
	}
};
