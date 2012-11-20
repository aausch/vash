/*jshint strict:false, asi: false, laxcomma:true, laxbreak:true, boss:true, curly:true, node:true, browser:true, devel:true */
;(function(){


	// grab/create the global. sigh.
	vash = typeof vash === 'undefined'
		? typeof window !== 'undefined'
			? ( window.vash = window.vash || {} )
			: typeof module !== 'undefined' && module.exports
				? exports = {}
				: {}
		: vash;

	///////////////////////////////////////////////////////////////////////////
	// EVENT SYSTEM

	vash.asEvented = (function(){

		var asEvented = function(proto){
			proto.on = on;
			proto.off = off;
			proto.emit = emit;
		}

		var on = function(name, fn){
			var lib = this._eevees = this._eevees || {};

			var cbs = lib[ name ] || (lib[ name ] = []);
			cbs.push( fn );
		}

		var off = function(name, fn){
			var lib = this._eevees = this._eevees || {};

			// remove all
			if( !fn ){
				delete lib[name];
				return;
			}

			var cbs = lib[ name ];

			if( !cbs || cbs.length === 0 ) return;

			for(var i = 0, len = cbs.length; i < len; i++ ){
				if( cbs[i] == fn ){
					cbs.splice( i, 1 );
					i--;
					len--;
				}
			}
		}

		var emit = function( name ){
			var lib = this._eevees = this._eevees || {}
				, cbs = lib[ name ] || (lib[ name ] = []);

			if( cbs.length == 0 ) return;

			var args = cbs.slice.call( arguments, 1 )
				, argsLen = args.length
				, result;

			cbs = cbs.slice(0);

			for( var i = 0, len = cbs.length; i < len; i++ ){
				if( argsLen === 0 ){
					result = cbs[i]();
				} else if( argsLen === 1 ){
					result = cbs[i]( args[0] )
			  } else if( argsLen === 2 ){
					result = cbs[i]( args[0], args[1] );
			  } else if( argsLen === 3 ){
					result = cbs[i]( args[0], args[1], args[2] );
			  } else {
					result = cbs[i].apply( null, args );
			  }

			  if( result === false ){ break; }
			}
		}

		return asEvented;
	}())

	// EVENT SYSTEM
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// HELPERS CONSTRUCTOR
	// Ideally this is where any helper-specific configuration would go, things
	// such as syntax highlighting callbacks, whether to temporarily disable
	// html escaping, and others.
	//
	// Each helper should define it's configuration options just above its own
	// definition, for ease of modularity and discoverability.

	var helpers = vash['helpers']
		,Helpers
		,Buffer;

	if ( !helpers ) {
		Helpers = function ( model ) {
			this.buffer = new Buffer();
			this.model  = model;

			this.vl = 0;
			this.vc = 0;
		};

		vash['helpers']
			= helpers
			= Helpers.prototype
			= { constructor: Helpers, config: { debugRuntime: false }};

		// AND IT SHALL BE EVENTED.
		vash.asEvented( Helpers.prototype );
	}

	// this allows a template to return the context, and coercion
	// will handle it
	helpers.toString = helpers.toHtmlString = function(){
		return this.buffer.toString();
	}

	// HELPERS CONSTRUCTOR
	///////////////////////////////////////////////////////////////////////////


	///////////////////////////////////////////////////////////////////////////
	// HTML ESCAPING

	var HTML_REGEX = /[&<>"'`]/g
		,HTML_REPLACER = function(match) { return HTML_CHARS[match]; }
		,HTML_CHARS = {
			"&": "&amp;"
			,"<": "&lt;"
			,">": "&gt;"
			,'"': "&quot;"
			,"'": "&#x27;"
			,"`": "&#x60;"
		};


	// raw: explicitly prevent an expression or value from being HTML escaped.

	helpers.raw = function( val ) {
		var func = function() { return val; };

		val = val != null ? val : "";

		return {
			 toHtmlString: func
			,toString: func
		};
	};

	helpers.escape = function( val ) {
		var	func = function() { return val; };

		val = val != null ? val : "";

		if ( typeof val.toHtmlString !== "function" ) {

			val = val.toString().replace( HTML_REGEX, HTML_REPLACER );

			return {
				 toHtmlString: func
				,toString: func
			};
		}

		return val;
	};

	// HTML ESCAPING
	///////////////////////////////////////////////////////////////////////////


	///////////////////////////////////////////////////////////////////////////
	// BUFFER MANIPULATION
	//
	// These are to be used from within helpers, to allow for manipulation of
	// output in a sane manner.

	Buffer = function() {
		var __vo = this.__vo = [];

		this.mark = function() {
			var mark = new Mark( this );
			mark.markedIndex = __vo.length;
			__vo.push( mark.uid );
			return mark;
		};

		this.fromMark = function( mark ) {
			var found = mark.findInBuffer();

			if( found > -1 ){
				// automatically destroy the mark from the buffer
				mark.destroy();
				// `found` will still be valid for a manual splice
				return __vo.splice( found, __vo.length );
			}

			// TODO: should not found behavior call this.empty(),
			// or return an empty array?
		};

		this.spliceMark = function( mark, numToRemove, add ){
			var found = mark.findInBuffer();

			if( found > -1 ){
				mark.destroy();
				arguments[0] = found;
				return __vo.splice.apply( __vo, arguments );
			}
		}

		this.empty = function() {
			return __vo.splice( 0, __vo.length );
		};

		this.push = function( buffer ) {
			if( buffer instanceof Array ) {
				__vo.push.apply( __vo, buffer );
			} else if ( arguments.length > 1 ) {
				__vo.push.apply( __vo, Array.prototype.slice.call( arguments ));
			} else {
				__vo.push( buffer );
			}
		};

		this.indexOf = function( str ){

			for( var i = 0; i < __vo.length; i++ ){
				if( __vo[i] == str ){
						return i;
				}
			}

			return -1;
		}

		this.splice = function(){
			return __vo.splice.apply( __vo, arguments );
		}

		this.index = function( idx ){
			return __vo[ idx ];
		}

		this.flush = function() {
			return this.empty().join( "" );
		};

		this.toString = this.toHtmlString = function(){
			// not using flush because then console.log( tpl() ) would artificially
			// affect the output
			return __vo.join( "" );
		}
	};

	// BUFFER MANIPULATION
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// MARKS
	// These can be used to manipulate the existing entries in the rendering
	// context. For an example, see the highlight helper.

	var Mark = function( buffer ){
		this.uid = 'VASHMARK-' + ~~( Math.random() * 10000000 );
		this.markedIndex = 0;
		this.buffer = buffer;
		this.destroyed = false;
	}

	Mark.prototype.destroy = function(){

		var found = this.findInBuffer();

		if( found > -1 ){
			this.buffer.splice( found, 1 );
			this.markedIndex = -1;
			this.Helpers = null;
		}

		this.destroyed = true;
	}

	Mark.prototype.findInBuffer = function(){

		if( this.destroyed ){
			return -1;
		}

		if( this.markedIndex && this.buffer.index( this.markedIndex ) === this.uid ){
			return this.markedIndex;
		}

		helpers.config.debugRuntime && console.log('could not find '
			+ this.uid + ' in buffer, using indexOf '
			,this.buffer.indexOf(this.uid), this.buffer.__vo)
		return this.markedIndex = this.buffer.indexOf( this.uid );
	}

	// MARKS
	///////////////////////////////////////////////////////////////////////////

	///////////////////////////////////////////////////////////////////////////
	// ERROR REPORTING

	// Liberally modified from https://github.com/visionmedia/jade/blob/master/jade.js
	helpers.constructor.reportError = function(e, lineno, chr, orig, lb){

		lb = lb || '!LB!';

		var lines = orig.split(lb)
			,contextSize = lineno === 0 && chr === 0 ? lines.length - 1 : 3
			,start = Math.max(0, lineno - contextSize)
			,end = Math.min(lines.length, lineno + contextSize);

		var contextStr = lines.slice(start, end).map(function(line, i, all){
			var curr = i + start + 1;

			return (curr === lineno ? '  > ' : '    ')
				+ (curr < 10 ? ' ' : '')
				+ curr
				+ ' | '
				+ line;
		}).join('\n');

		e.message = 'Problem while rendering template at line '
			+ lineno + ', character ' + chr
			+ '.\nOriginal message: ' + e.message + '.'
			+ '\nContext: \n\n' + contextStr + '\n\n';

		throw e;
	};

	helpers.reportError = function() {
		this.constructor.reportError.apply( this, arguments );
	};
}());
