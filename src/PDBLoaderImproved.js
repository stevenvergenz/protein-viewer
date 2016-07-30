'use strict';

(function(THREE)
{
	// atomic colors
	var CPK = {"h":16777215,"he":14286847,"li":13402367,"be":12779264,"b":16758197,"c":9474192,"n":3166456,"o":16715021,"f":9494608,"ne":11789301,"na":11230450,"mg":9109248,"al":12560038,"si":15780000,"p":16744448,"s":16777008,"cl":2093087,"ar":8442339,"k":9388244,"ca":4062976,"sc":15132390,"ti":12567239,"v":10921643,"cr":9083335,"mn":10255047,"fe":14706227,"co":15765664,"ni":5296208,"cu":13140019,"zn":8224944,"ga":12750735,"ge":6721423,"as":12419299,"se":16752896,"br":10889513,"kr":6076625,"rb":7351984,"sr":65280,"y":9764863,"zr":9756896,"nb":7586505,"mo":5551541,"tc":3907230,"ru":2396047,"rh":687500,"pd":27013,"ag":12632256,"cd":16767375,"in":10909043,"sn":6717568,"sb":10380213,"te":13924864,"i":9699476,"xe":4366000,"cs":5707663,"ba":51456,"la":7394559,"ce":16777159,"pr":14286791,"nd":13107143,"pm":10747847,"sm":9437127,"eu":6422471,"gd":4587463,"tb":3211207,"dy":2097095,"ho":65436,"er":58997,"tm":54354,"yb":48952,"lu":43812,"hf":5096191,"ta":5089023,"w":2200790,"re":2522539,"os":2516630,"ir":1528967,"pt":13684960,"au":16765219,"hg":12105936,"tl":10900557,"pb":5724513,"bi":10375093,"po":11230208,"at":7688005,"rn":4358806,"fr":4325478,"ra":32000,"ac":7384058,"th":47871,"pa":41471,"u":36863,"np":33023,"pu":27647,"am":5528818,"cm":7888099,"bk":9064419,"cf":10565332,"es":11739092,"fm":11739066,"md":11734438,"no":12389767,"lr":13041766,"rf":13369433,"db":13697103,"sg":14221381,"bh":14680120,"hs":15073326,"mt":15400998,"ds":15400998,"rg":15400998,"cn":15400998,"uut":15400998,"uuq":15400998,"uup":15400998,"uuh":15400998,"uus":15400998,"uuo":15400998};

	var covalentRadius = {h:31, he:28, li:128, be:96, b:84, c:73, n:71, o:66, f:57, na:166, mg:141, al:121, si:111, p:107, s:105, cl:102, k:203, ca:176, sc:170, ti:160, v:153, cr:139, mn:139, fe:132, co:126, ni:124, cu:132, zn:122, ga:122, ge:120, as:119, se:120, br:120};

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
			function parseChainInfo(line)
			{
				
			}
			
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
						type: match[0].slice(0,6).trim(),
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
		
			var lines = text.split('\r\n');
			if(lines.length === 1)
				lines = text.split('\n');
			
			var cursor = 0;
			var data = {};
			
			

			// check for MODELs
			var start = lines.slice(cursor).findIndex(function(e,i){ return /^MODEL/.test(e); });
			var end   = lines.slice(cursor).findIndex(function(e,i){ return /^ENDMDL/.test(e); });
			if( start !== -1 && end !== -1 ){
				data.model = parseModel( lines.slice(cursor+start, cursor+end+1) );
				cursor += end+1;
			}

			// load all atoms into one model if no MODEL/ENDMDL tags
			if(!data.model)
			{
				var defaultModel = lines
					.map(function(e){ return parseAtom(e); })
					.filter(function(e){ return !!e; });
				data.model = {atoms: defaultModel};
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
			options.mergeLikeAtoms = options.mergeLikeAtoms !== undefined ? options.mergeLikeAtoms : false;
			options.meshVertexLimit = options.meshVertexLimit || 65000;
			options.bondFudgeFactor = options.bondFudgeFactor || 0.14;
			options.verbose = options.verbose !== undefined ? options.verbose : true;

			var molecule = json.model;
			
			var model = new THREE.Object3D();
			var atomMap = {};
			var bondMap = {};

			// compute bounding box
			var max = new THREE.Vector3(), min = new THREE.Vector3();
			molecule.atoms.forEach(function(a){
				var pos = new THREE.Vector3(a.x, a.y, a.z);
				max.max(pos);
				min.min(pos);
			});

			// compute offset
			var offset = max.clone().add(min).multiplyScalar(0.5);

			var stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 3, 1, true), new THREE.MeshBasicMaterial({color: 0xffffff}));
			stick.geometry.rotateX(Math.PI/2);
			var bonds = new THREE.Mesh(new THREE.Geometry(), stick.material);
			bonds.name = 'bonds';
			if(options.mergeLikeAtoms)
				model.add(bonds);


			// loop over all atoms in the molecule
			molecule.atoms.forEach(function(atom, i)
			{
				/*
				* Generate atom balls
				*/

				var e = atom.element.toLowerCase();

				// index materials and/or meshes
				if(!atomMap[e])
				{
					atomMap[e] = new THREE.Mesh(new THREE.Geometry(), new THREE.MeshBasicMaterial({color: CPK[e]}));
					atomMap[e].name = e+'_group';
					if(options.mergeLikeAtoms)
						model.add(atomMap[e]);
				}

				// lookup table is in picometers (1e-12), so convert to angstroms (1e-10)
				var radius = 0.15*(covalentRadius[e]*0.01 || 1.25);
				var mesh = new THREE.Mesh(new THREE.BoxGeometry(2*radius, 2*radius, 2*radius), atomMap[e].material);
				mesh.name = 'atom_'+atom.serial;

				// position in angstroms
				mesh.position.set(atom.x, atom.y, atom.z).sub(offset);
				mesh.updateMatrix();

				// add to molecule
				if(options.mergeLikeAtoms)
				{
					if(atomMap[e].geometry.faces.length*3 + mesh.geometry.faces.length*3 > options.meshVertexLimit)
					{
						atomMap[e] = new THREE.Mesh(new THREE.Geometry(), atomMap[e].material);
						model.add(atomMap[e]);
					}

					atomMap[e].geometry.mergeMesh(mesh);
				}
				else
					model.add(mesh);


				/*
				* Generate bond sticks
				*/

				// look ahead for any atoms that are nearby
				for(var j=i+1; j<molecule.atoms.length; j++)
				{
					var neighbor = molecule.atoms[j];
					if(neighbor.chainId !== atom.chainId)
						continue;
					
					var v2 = new THREE.Vector3(neighbor.x, neighbor.y, neighbor.z).sub(offset);

					// get distance between atoms, compared to covalent radii
					var dist = mesh.position.distanceTo(v2);
					var covalentDist = 0.01*covalentRadius[e] + 0.01*covalentRadius[neighbor.element.toLowerCase()];

					// they are bonded
					if( Math.abs(dist - covalentDist) <= options.bondFudgeFactor*covalentDist )
					{
						// add to bond map
						if(bondMap[i]) bondMap[i].push(j);
						else bondMap[i] = [j];

						// generate stick
						var start = mesh.position, end = v2;
						stick.position.copy( start );
						stick.position.lerp( end, 0.5 );
						stick.scale.setZ( start.distanceTo( end ) );
						stick.lookAt( end );

						if(options.mergeLikeAtoms)
						{
							if(bonds.geometry.faces.length*3 + stick.geometry.faces.length*3 > options.meshVertexLimit)
							{
								bonds = new THREE.Mesh(new THREE.Geometry(), stick.material);
								model.add(bonds);
							}

							bonds.geometry.mergeMesh(stick);
						}
						else
							model.add( stick.clone() );
					}
				}
			});

			// generate manual bonds
			json.bonds.forEach(function(bond)
			{
				for(var i=1; bond['bond'+i] && i<=4; i++)
				{
					// make sure a < b
					var a = Math.min(bond.atomIndex, bond['bond'+i]) - 1,
						b = Math.max(bond.atomIndex, bond['bond'+i]) - 1;
					
					var aa = molecule.atoms[a], ab = molecule.atoms[b];
					var va = new THREE.Vector3(aa.x, aa.y, aa.z).sub(offset);
					var vb = new THREE.Vector3(ab.x, ab.y, ab.z).sub(offset);

					if( !bondMap[a] || !bondMap[a].includes(b) )
					{
						// add to bond map
						bondMap[a] = bondMap[a] || [];
						bondMap[a].push(b);

						// generate stick
						stick.position.copy( va );
						stick.position.lerp( vb, 0.5 );
						stick.scale.setZ( va.distanceTo( vb ) );
						stick.lookAt( vb );

						if(options.mergeLikeAtoms)
						{
							if(bonds.geometry.faces.length*3 + stick.geometry.faces.length*3 > options.meshVertexLimit)
							{
								bonds = new THREE.Mesh(new THREE.Geometry(), stick.material);
								model.add(bonds);
							}

							bonds.geometry.mergeMesh(stick);
						}
						else
							model.add( stick.clone() );
					}
				}
			});

			if(options.verbose)
			{
				// check for empty geometry
				model.traverse(function(o){
					if(o.geometry && o.geometry.faces.length === 0){
						console.log('No faces in mesh', o.name);
					}
				});

				// check for unbonded or overbonded atoms
				var bondCount = {};
				molecule.atoms.forEach(function(a,i){
					bondCount[i] = 0;
				});
				
				for(var i in bondMap)
				{
					bondCount[i] += bondMap[i].length;
					for(var j=0; j<bondMap[i].length; j++){
						bondCount[ bondMap[i][j] ] += 1;
					}
				}
				
				console.log('Most bonded atom has:',
					Object.keys(bondCount).reduce(function(sum,ai){
						return Math.max(sum, bondCount[ai]);
					}, 0)
				);
				
				for(var i in bondCount)
				{
					if(bondCount[i] === 0 && molecule.atoms[i].type !== 'HETATM'){
						console.log(molecule.atoms[i], 'is unbonded!');
					}
				}
			}

			model.userData = json;

			return model;
		}
	};

})(window.THREE = window.THREE || {});

