'use strict';

// set up global variables
var sync, renderer, camera, model;
var scene = new THREE.Scene();
var root = new THREE.Object3D();
scene.add(root);

// start animating
window.requestAnimationFrame(function animate(timestamp)
{
	window.requestAnimationFrame(animate);
	scene.updateAllBehaviors();
	renderer.render(scene, camera);
});


// start loading everything in the right order
async.parallel(
	[
		loadModel,
		setupRenderer,
		setupEnclosure
		//setupSync,
		//setupUI
	],
	start
);

function loadModel(done)
{
	// these should be only those molecules that
	var defaultTransform = {
		'2VAA': new THREE.Matrix4().fromArray([0.025214113295078278, 0, 0, 0, 0, -5.5986578251406355e-18, 0.025214113295078278, 0, 0, -0.025214113295078278, -5.5986578251406355e-18, 0, 0, 0, 0.800000011920929, 1]),
		'3UTQ': new THREE.Matrix4().fromArray([0.01705673336982727, 5.356129710311007e-18, 0.01705673336982727, 0, -0.01705673336982727, 2.41829112290759e-10, 0.01705673336982727, 0, 0, -0.02412186563014984, 2.418291400463346e-10, 0, 0, 0, 1, 1]),
		'4X5W': new THREE.Matrix4().fromArray([0.019939063116908073, 0, 0, 0, 0, -0.01633312553167343, -0.011436576955020428, 0, 0, 0.011436576955020428, -0.01633312553167343, 0, 0, 0, 0.800000011920929, 1]),
		'1AQD': new THREE.Matrix4().fromArray([0.016878578811883926, -2.02829339088948e-18, -0.0069913361221551895, 0, 0.0069913361221551895, -2.5196064679100516e-10, 0.016878578811883926, 0, 2.02829339088948e-18, -0.018269242718815804, -2.5196064679100516e-10, 0, 0, 0, 0.8999999761581421, 1]),
		'2WBJ': new THREE.Matrix4().fromArray([0.009671138599514961, -0.009671138599514961, 5.6795596004022286e-11, 0, 5.6795592534575334e-11, 2.9775890086902734e-10, 0.013677055947482586, 0, -0.009671138599514961, -0.009671138599514961, 2.9775887311345173e-10, 0, 0, 3.191891129622876e-17, 1.2999999523162842, 1]),
		'1J8H': new THREE.Matrix4().fromArray([0.016748936846852303, 0, 0, 0, 0, 0.016748936846852303, 0, 0, 0, 0, 0.016748936846852303, 0, 0, 0, 1.2999999523162842, 1])
	};

	// highlight active options
	if(!/[?&]noribbon/.test(window.location.search))
		document.getElementById('ribbon').style.color = '#87ceeb';
	if(!/[?&]noball/.test(window.location.search))
		document.getElementById('ball').style.color = '#87ceeb';

	var colorMatch = /[&?]color=(residue|structure|chain)/.exec(window.location.search);
	if(!colorMatch)
		document.getElementById('nocolor').style.color = '#87ceeb';
	else
		document.getElementById(colorMatch[1]).style.color = '#87ceeb';

	// highlight active molecule
	var molId = /[?&]molecule=(\w+)/.exec(window.location.search);
	if(!molId){
		document.getElementById('loading').style.display = 'none';
		return done();
	}

	molId = molId[1];

	var menuItem = document.getElementById(molId);
	if(menuItem)
		menuItem.style.color = '#87ceeb';
	else {
		document.getElementById('other').style.color = '#87ceeb';
		document.getElementById('ribbon').style['pointer-events'] = 'none';
		document.getElementById('ribbon').style.color = '#333';
	}

	var molecule = new THREE.Object3D();

	async.parallel([

		// load pdb file
		function(done)
		{
			if( /[?&]noball/.test(window.location.search) )
				return done();

			var localModels = ['2VAA','3UTQ','4X5W','1J8H','1AQD','2WBJ'];
			if(localModels.indexOf(molId) !== -1)
				var url = 'models/pdb/'+molId+'.pdb';
			else
				var url = 'https://files.rcsb.org/download/'+molId+'.pdb';

			var loader = new THREE.PDBLoader();
			loader.load(url, {colorScheme: colorMatch && colorMatch[1]}, function(model)
			{
				done(null, model);
			}, null, done);
		},

		// load ribbon file
		function(done)
		{
			if( /[?&]noribbon/.test(window.location.search) )
				return done();

			var colors = {
				sheet1: 0xcef615,
				helix2: 0x3e39fb,
				helix1: 0xd804e0,
				turn1: 0xcfcfcf,
				turn2: 0x008080,
				turn3: 0x2e8a1c,
				default: [0xff3737, 0x04e3d1, 0xffbb18, 0xffb4b4],
				defaultCount: 0
			};

			var loader = new THREE.glTFLoader();
			loader.load('models/ribbon/'+molId+'.gltf', function(model)
			{
				var ribbon = model.scene.children[0].children[0];
				window.ribbon = ribbon;
				ribbon.matrix.identity();
				ribbon.matrix.decompose(ribbon.position, ribbon.quaternion, ribbon.scale);

				// color all children of each top level child by the name of the top-level child
				ribbon.children.forEach(function(o, i){
					o.traverse(function(o2){
						if(o2 instanceof THREE.Mesh)
						{
							o2.material.side = THREE.DoubleSide;

							for(var i in colors)
							{
								if(new RegExp('^'+i).test(o.name)){
									o2.material.color.set(colors[i]);
									return;
								}
							}
							o2.material.color.set(colors.default[colors.defaultCount++%4])
						}
					});
				});

				done(null, ribbon);
			});
		}],

		function(err, results)
		{
			if(err)
				done(err);
			else {
				var model = new THREE.Object3D();

				if(results[0]) model.add(results[0]);
				if(results[1]) model.add(results[1]);

				if(defaultTransform[molId])
					model.applyMatrix( defaultTransform[molId] );
				else
				{
					var radius = Utils.computeObjectRadius(model);
					model.scale.multiplyScalar(1.0/radius);
					model.position.set(0, 0, 1.0);
				}

				done(null, model);
			}

			document.getElementById('loading').style.display = 'none';
		}
	);
}


function setupRenderer(done)
{
	var initialBufferSize = {
		'1AQD': 30330519,
		'2VAA':  7895284,
		'3UTQ':  7895284,
		'4X5W':  7895284,
		'1J8H': 15474755,
		'2WBJ': 30330519,
		'3WPG': 11053397
	};
	var molId = /[?&]molecule=(\w+)/.exec(window.location.search);
	molId = molId && molId[1];

	if(altspace.inClient){
		renderer = altspace.getThreeJSRenderer({
			initialSerializationBufferSize: initialBufferSize[molId] || (1<<20),
			profile: false
		});
	}
	else {
		// set up preview renderer, in case we're out of world
		renderer = new THREE.WebGLRenderer();
		renderer.setSize(1024, 1024);
		renderer.setClearColor( 0 );
		document.body.appendChild(renderer.domElement);

		//camera = new THREE.PerspectiveCamera(90, 1, 0.01, 10000);
		camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 100);
		camera.up.set(0,0,1);
		camera.position.set(0, 2, 1.5);
		camera.lookAt(new THREE.Vector3(0, 0, 1.5));
		root.add(camera);

		// add bounding box
		/*var box = new THREE.Mesh(
			new THREE.BoxGeometry(3,3,3),
			new THREE.MeshBasicMaterial({wireframe: true})
		);
		box.position.set(0,0,1.5);
		root.add(box);*/
	}


	done();
}

function setupEnclosure(done)
{
	if(altspace.inClient)
	{
		altspace.getEnclosure().then(function(e){
			root.position.setY(-e.innerHeight/2);
			root.scale.multiplyScalar(e.pixelsPerMeter);
			root.rotation.set( -Math.PI/2, 0, 0 );
			done(e.innerDepth===1);
		});
	}
	else {
		done();
	}
}

/*function setupSync(done)
{
	if(altspace.inClient)
	{
		altspace.utilities.sync.connect({
			authorId: 'Derogatory',
			appId: 'protein-viewer'
		}).then(function(conn)
		{
			sync = conn;
			done();
		},
		function(err)
		{
			console.warn('Could not connect to firebase:', err);
			done();
		});
	}
	else {
		done();
	}
}

function setupUI(done)
{
	done();
}*/

function start(err, results)
{
	if(err){
		console.error(err);
		return;
	}
	console.log(results);

	if(results[0]){
		window.molecule = results[0];
		root.add(molecule);
	}

}

