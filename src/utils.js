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


})(window.Utils = window.Utils || {});
