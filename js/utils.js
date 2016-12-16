'use strict';

(function(exports){

	THREE.Object3D.prototype.getChildByType = function(type)
	{
		for(var i=0; i<this.children.length; i++)
			if(this.children[i] instanceof type)
				return this.children[i];
	}
	
	THREE.Object3D.prototype.getChildByName2 = function(name)
	{
		for(var i=0; i<this.children.length; i++)
			if(this.children[i].name === name)
				return this.children[i];
	}

	function computeObjectRadius(o, center)
	{
		center = center || new THREE.Vector3(0,0,0);
		var max = 0;

		if(o instanceof THREE.Mesh)
		{
			var vertexList = o.geometry.getAttribute('position');
			for(var i=0; i<vertexList.count; i++)
			{
				var vert = new THREE.Vector3().fromArray( Array.prototype.slice.call(vertexList.array, 3*i, 3*i+3) );
				var test = vert.distanceTo(center);
				if(test > max) max = test;
			}
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

	exports.computeObjectRadius = computeObjectRadius;

})(window.Utils = window.Utils || {});
