'use strict';

(function(THREE)
{
	// atomic colors
	var CPK = { "h": [ 255, 255, 255 ], "he": [ 217, 255, 255 ], "li": [ 204, 128, 255 ], "be": [ 194, 255, 0 ], "b": [ 255, 181, 181 ], "c": [ 144, 144, 144 ], "n": [ 48, 80, 248 ], "o": [ 255, 13, 13 ], "f": [ 144, 224, 80 ], "ne": [ 179, 227, 245 ], "na": [ 171, 92, 242 ], "mg": [ 138, 255, 0 ], "al": [ 191, 166, 166 ], "si": [ 240, 200, 160 ], "p": [ 255, 128, 0 ], "s": [ 255, 255, 48 ], "cl": [ 31, 240, 31 ], "ar": [ 128, 209, 227 ], "k": [ 143, 64, 212 ], "ca": [ 61, 255, 0 ], "sc": [ 230, 230, 230 ], "ti": [ 191, 194, 199 ], "v": [ 166, 166, 171 ], "cr": [ 138, 153, 199 ], "mn": [ 156, 122, 199 ], "fe": [ 224, 102, 51 ], "co": [ 240, 144, 160 ], "ni": [ 80, 208, 80 ], "cu": [ 200, 128, 51 ], "zn": [ 125, 128, 176 ], "ga": [ 194, 143, 143 ], "ge": [ 102, 143, 143 ], "as": [ 189, 128, 227 ], "se": [ 255, 161, 0 ], "br": [ 166, 41, 41 ], "kr": [ 92, 184, 209 ], "rb": [ 112, 46, 176 ], "sr": [ 0, 255, 0 ], "y": [ 148, 255, 255 ], "zr": [ 148, 224, 224 ], "nb": [ 115, 194, 201 ], "mo": [ 84, 181, 181 ], "tc": [ 59, 158, 158 ], "ru": [ 36, 143, 143 ], "rh": [ 10, 125, 140 ], "pd": [ 0, 105, 133 ], "ag": [ 192, 192, 192 ], "cd": [ 255, 217, 143 ], "in": [ 166, 117, 115 ], "sn": [ 102, 128, 128 ], "sb": [ 158, 99, 181 ], "te": [ 212, 122, 0 ], "i": [ 148, 0, 148 ], "xe": [ 66, 158, 176 ], "cs": [ 87, 23, 143 ], "ba": [ 0, 201, 0 ], "la": [ 112, 212, 255 ], "ce": [ 255, 255, 199 ], "pr": [ 217, 255, 199 ], "nd": [ 199, 255, 199 ], "pm": [ 163, 255, 199 ], "sm": [ 143, 255, 199 ], "eu": [ 97, 255, 199 ], "gd": [ 69, 255, 199 ], "tb": [ 48, 255, 199 ], "dy": [ 31, 255, 199 ], "ho": [ 0, 255, 156 ], "er": [ 0, 230, 117 ], "tm": [ 0, 212, 82 ], "yb": [ 0, 191, 56 ], "lu": [ 0, 171, 36 ], "hf": [ 77, 194, 255 ], "ta": [ 77, 166, 255 ], "w": [ 33, 148, 214 ], "re": [ 38, 125, 171 ], "os": [ 38, 102, 150 ], "ir": [ 23, 84, 135 ], "pt": [ 208, 208, 224 ], "au": [ 255, 209, 35 ], "hg": [ 184, 184, 208 ], "tl": [ 166, 84, 77 ], "pb": [ 87, 89, 97 ], "bi": [ 158, 79, 181 ], "po": [ 171, 92, 0 ], "at": [ 117, 79, 69 ], "rn": [ 66, 130, 150 ], "fr": [ 66, 0, 102 ], "ra": [ 0, 125, 0 ], "ac": [ 112, 171, 250 ], "th": [ 0, 186, 255 ], "pa": [ 0, 161, 255 ], "u": [ 0, 143, 255 ], "np": [ 0, 128, 255 ], "pu": [ 0, 107, 255 ], "am": [ 84, 92, 242 ], "cm": [ 120, 92, 227 ], "bk": [ 138, 79, 227 ], "cf": [ 161, 54, 212 ], "es": [ 179, 31, 212 ], "fm": [ 179, 31, 186 ], "md": [ 179, 13, 166 ], "no": [ 189, 13, 135 ], "lr": [ 199, 0, 102 ], "rf": [ 204, 0, 89 ], "db": [ 209, 0, 79 ], "sg": [ 217, 0, 69 ], "bh": [ 224, 0, 56 ], "hs": [ 230, 0, 46 ], "mt": [ 235, 0, 38 ], "ds": [ 235, 0, 38 ], "rg": [ 235, 0, 38 ], "cn": [ 235, 0, 38 ], "uut": [ 235, 0, 38 ], "uuq": [ 235, 0, 38 ], "uup": [ 235, 0, 38 ], "uuh": [ 235, 0, 38 ], "uus": [ 235, 0, 38 ], "uuo": [ 235, 0, 38 ] };

	//var CPK = {"h":65535,"he":65535,"li":33023,"be":65474,"b":46591,"c":37008,"n":20728,"o":3583,"f":57552,"ne":58359,"na":23803,"mg":65418,"al":42687,"si":51440,"p":33023,"s":65535,"cl":61471,"ar":53731,"k":16607,"ca":65341,"sc":59110,"ti":49919,"v":42671,"cr":39375,"mn":31455,"fe":26355,"co":37104,"ni":53328,"cu":33019,"zn":33021,"ga":36815,"ge":36847,"as":33023,"se":41471,"br":10671,"kr":47325,"rb":12016,"sr":65280,"y":65535,"zr":57588,"nb":49915,"mo":46581,"tc":40639,"ru":36783,"rh":32142,"pd":27013,"ag":49344,"cd":55807,"in":30199,"sn":32998,"sb":25535,"te":31444,"i":148,"xe":40690,"cs":6111,"ba":51456,"la":54527,"ce":65535,"pr":65503,"nd":65479,"pm":65511,"sm":65487,"eu":65511,"gd":65479,"tb":65527,"dy":65503,"ho":65436,"er":58997,"tm":54354,"yb":48952,"lu":43812,"hf":49919,"ta":42751,"w":38135,"re":32175,"os":26294,"ir":21655,"pt":53488,"au":53759,"hg":47352,"tl":21743,"pb":22903,"bi":20415,"po":23723,"at":20341,"rn":33494,"fr":102,"ra":32000,"ac":44026,"th":47871,"pa":41471,"u":36863,"np":33023,"pu":27647,"am":23798,"cm":23803,"bk":20459,"cf":14069,"es":8183,"fm":8123,"md":3511,"no":3519,"lr":231,"rf":221,"db":223,"sg":221,"bh":248,"hs":238,"mt":239,"ds":239,"rg":239,"cn":239,"uut":239,"uuq":239,"uup":239,"uuh":239,"uus":239,"uuo":239};

	var covalentRadius = {h:25, li:145, be:105, b:85, c:70, n:65, o:60, f:50, na:180, mg:150, al:125, si:110, p:100, s:100, cl:100, k:220, ca:180, sc:160, ti:140, v:135, cr:140, mn:140, fe:140, co:135, ni:135, cu:135, zn:135, ga:130, ge:125, as:115, se:115, br:115};

	THREE.PDBLoader = function ( manager ) {
		this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
	};

	THREE.PDBLoader.prototype = {

		constructor: THREE.PDBLoader,

		load: function ( url, onLoad, onProgress, onError ) {

			var scope = this;

			var loader = new THREE.XHRLoader( scope.manager );
			loader.load( url, function (text)
			{
				var json = scope.parsePDB(text);
				var models = scope.createStickBallModels(json);
				onLoad(models, json);
			}, onProgress, onError );

		},


		parsePDB: function(text)
		{
			function parseModel(lines)
			{
				var modelRE = /^MODEL     (.{4})/;
				var endmdlRE = /^ENDMDL/;

				// check for start and end tags
				var match = modelRE.exec(lines[0]);
				if(match)
					var modelNum = parseInt(match[1]);
				else
					return null;

				if(!endmdlRE.test(lines[lines.length-1]))
					return null;

				// load atom list
				var atoms = [];
				for(var i=1; i<lines.length-1; i++)
				{
					var atom = parseAtom(lines[i]);
					if(atom) atoms.push(atom);
				}

				return {
					serial: modelNum,
					atoms: atoms
				};
			}

			function parseAtom(line)
			{
				var atomRE = /^(?:HETATM|ATOM  )(.{5}) (.{4})(.)(.{3}) (.)(.{4})(.)   (.{8})(.{8})(.{8})(.{6})(.{6})          (.{2})(.{2})$/;

				var match = atomRE.exec(line);
				if(match)
				{
					var fields = match.slice(1).map(function(s){ return s.trim(); });

					return {
						text: match,
						serial: parseInt(fields[0]),
						name: fields[1],
						altLoc: fields[2],
						resName: fields[3],
						chainID: fields[4],
						resSeq: fields[5],
						iCode: fields[6],
						x: parseFloat(fields[7]),
						y: parseFloat(fields[8]),
						z: parseFloat(fields[9]),
						occupancy: parseFloat(fields[10]),
						tempFactor: parseFloat(fields[11]),
						element: fields[12],
						charge: fields[13]
					};
				}

				else return null;
			}

			function parseBond(line)
			{
				var conectRE = /^CONECT (.{5})(.{5})(.{5})(.{5})(.{5})/;
				var match = conectRE.exec(line);
				if(match)
				{
					return {
						atomIndex: parseInt(match[1]),
						bond1: parseInt(match[2]),
						bond2: parseInt(match[3]),
						bond3: parseInt(match[4]),
						bond4: parseInt(match[5])
					};
				}
				else
					return null;
			}
		
			var lines = text.split('\n');
			var cursor = 0;
			var data = {};

			// check for MODELs
			data.models = [];
			do
			{
				var start = lines.slice(cursor).findIndex(function(e,i){ return /^MODEL/.test(e); });
				var end   = lines.slice(cursor).findIndex(function(e,i){ return /^ENDMDL/.test(e); });
				if( start !== -1 && end !== -1 ){
					data.models.push( parseModel( lines.slice(cursor+start, cursor+end+1) ) );
					cursor += end+1;
				}
			}
			while( start !== -1 && end !== -1 );

			// load all atoms into one model if no MODEL/ENDMDL tags
			if(data.models.length === 0)
			{
				var defaultModel = lines
					.map(function(e){ return parseAtom(e); })
					.filter(function(e){ return !!e; });
				data.models.push(defaultModel);
			}

			// load manual connections
			var bonds = lines
				.slice(cursor)
				.map(function(e){ return parseBond(e); })
				.filter(function(e){ return !!e; });

			data.bonds = bonds;

			console.log(data);
			return data;
		},

		createStickBallModels: function(json, options)
		{
			// define default options
			options = options || {};
			options.mergeLikeAtoms = options.mergeLikeAtoms || true;

			var molecules = [];

			// loop over all models in the PDB
			json.models.forEach(function(model)
			{
				var molecule = new THREE.Object3D();
				var atomMap = {};

				// compute bounding box
				var max = new THREE.Vector3(), min = new THREE.Vector3();
				model.atoms.forEach(function(a){
					var pos = new THREE.Vector3(a.x, a.y, a.z);
					max.max(pos);
					min.min(pos);
				});

				// compute offset
				var offset = max.clone().add(min).multiplyScalar(0.5);

				// loop over all atoms in the model
				model.atoms.forEach(function(atom)
				{
					var e = atom.element.toLowerCase();

					// index materials and/or meshes
					if(!atomMap[e])
					{
						var color = (CPK[e][0] << 16) | (CPK[e][1] << 8) | (CPK[e][2]);
						atomMap[e] = new THREE.Mesh(new THREE.Geometry(), new THREE.MeshBasicMaterial({color: color}));
						atomMap[e].name = e;
						if(options.mergeLikeAtoms)
							molecule.add(atomMap[e]);
					}

					// lookup table is in picometers (1e-12), so convert to angstroms (1e-10)
					var radius = (covalentRadius[e]*1e-2 || 1.25)/2;
					var mesh = new THREE.Mesh(new THREE.BoxGeometry(radius, radius, radius), atomMap[e].material);

					// position in angstroms
					mesh.position.set(atom.x, atom.y, atom.z).sub(offset);
					//mesh.position.multiplyScalar(1e-4);

					// add to molecule
					if(options.mergeLikeAtoms)
						atomMap[e].geometry.mergeMesh(mesh);
					else
						molecule.add(mesh);
				});

				// sanity check
				molecule.children.forEach(function(o){
					if(o.geometry.faces.length === 0)
						console.log(o.name, 'has no faces');
				});

				molecules.push(molecule);
			});

			return molecules;
		}
	};

})(window.THREE = window.THREE || {});

