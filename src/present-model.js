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

function computeObjectRadius(o, center)
{
	center = center || new THREE.Vector3(0,0,0);
	var max = 0;

	if(o instanceof THREE.Mesh)
	{
		o.geometry.vertices.forEach(function(vert)
		{
			var test = vert.distanceTo(center);
			if(test > max) max = test;
		});
	}
	else
	{
		o.children.forEach(function(child)
		{
			var inverse = new THREE.Matrix4().getInverse(child.matrix);
			var test = computeObjectRadius(child, center.clone().applyMatrix4(inverse));
			if(test > max) max = test;
		});
	}

	return max;
}

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
	var defaultTransform = {
		'2VAA': new THREE.Matrix4().fromArray([5.0921660370876786e-18, 0.022933077067136765, -5.0921660370876786e-18, 0, 0, 5.0921660370876786e-18, 0.022933077067136765, 0, 0.022933077067136765, -5.0921660370876786e-18, 0, 0, 0, 0, 1, 1]),
		//'2M6C': new THREE.Matrix4().fromArray([0.09831853955984116, 0, 0, 0, 0, 0.09831853955984116, 0, 0, 0, 0, 0.09831853955984116, 0, 0, 0, 1.2, 1])
		'2M6C': new THREE.Matrix4().fromArray([-0.09831853955984116, 1.2040150655926865e-17, -4.816060262370746e-17, 0, -4.816060262370746e-17, -4.366220254674198e-17, 0.09831853955984116, 0, 1.2040150655926865e-17, 0.09831853955984116, 4.366220254674198e-17, 0, 0, 0, 1.2000000476837158, 1])
	};

	var molId = /[?&]molecule=(\w+)/.exec(window.location.search);
	if(!molId)
		return done();

	molId = molId[1];

	var menuItem = document.getElementById(molId);
	if(menuItem) menuItem.style.color = '#87ceeb';


	var molecule = new THREE.Object3D();

	async.parallel([

		// load pdb file
		function(done)
		{
			if( /[?&]noball/.test(window.location.search) )
				return done();

			var loader = new THREE.PDBLoader();
			loader.load('models/pdb/'+molId+'.pdb', function(model)
			{
				done(null, model);
			}, null, done);
		},

		// load ribbon file
		function(done)
		{
			if( /[?&]noribbon/.test(window.location.search) )
				return done();

			var loader = new THREE.glTFLoader();
			loader.load('models/ribbon/'+molId+'.gltf', function(model)
			{
				var ribbon = model.scene.children[0].children[0].children[0];
				//ribbon.material.color.set(0xffff00);
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
					var radius = computeObjectRadius(model);
					model.scale.multiplyScalar(1.0/radius);
					model.position.set(0, 0, 1.2);
					model.rotation.set(0, 0, Math.PI/2);
				}

				done(null, model);
			}
		}
	);
}


function setupRenderer(done)
{
	if(altspace.inClient){
		renderer = altspace.getThreeJSRenderer();
	}
	else {
		// set up preview renderer, in case we're out of world
		renderer = new THREE.WebGLRenderer();
		renderer.setSize(720, 720);
		renderer.setClearColor( 0 );
		document.body.appendChild(renderer.domElement);

		//camera = new THREE.PerspectiveCamera(90, 1, 0.01, 10000);
		camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 100);
		camera.up.set(0,0,1);
		camera.position.set(2, 0, 1.5);
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

