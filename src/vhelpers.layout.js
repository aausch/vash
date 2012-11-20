;(function(){


	///////////////////////////////////////////////////////////////////////////
	// LAYOUT HELPERS

	// semi hacky guard to prevent non-nodejs erroring
	if( typeof window === 'undefined' ){
		var  fs = require('fs')
			,path = require('path')
	}

	var helpers = vash.helpers;

	// TRUE implies that all TPLS are loaded and waiting in cache
	helpers.config.browser = false;
	helpers.config.debugLayout = false;

	helpers.tplcache = {};

	vash.loadFile = function(filepath, options, cb){

		// options are passed in via Express
		// {
		//   settings:
		//   {
		//      env: 'development',
		//   	'jsonp callback name': 'callback',
		//   	'json spaces': 2,
		//   	views: '/Users/drew/Dropbox/js/vash/test/fixtures/views',
		//   	'view engine': 'vash'
		//   },
		//   _locals: [Function: locals],
		//   cache: false
		// }

		// extend works from right to left, using first arg as target
		options = vQuery.extend( {}, vash.config, options || {} );

		var browser = helpers.config.browser
			,tpl

		if( !browser && options.settings && options.settings.views && options.settings['view engine'] ){
			filepath = filepath.indexOf(options.settings.views) > -1
				? filepath
				: path.join( options.settings.views
					,filepath
					+ ( path.extname(filepath)
						? ''
						: '.' + options.settings['view engine'] ) );
		}

		// if browser, tpl must exist in tpl cache
		tpl = options.cache || browser
			? helpers.tplcache[filepath] || ( helpers.tplcache[filepath] = vash.compile(fs.readFileSync(filepath, 'utf8')) )
			: vash.compile( fs.readFileSync(filepath, 'utf8') )

		cb && cb(null, tpl);
	}

	vash.renderFile = function(filepath, options, cb){

		vash.loadFile(filepath, options, function(err, tpl){
			cb(err, tpl(options));
		})
	}

	helpers.consumeContext = function( context ){
		var p, things, self = this;

		this.ensureLayoutProperties();

		for( p in context.blocks ){
			things = this.blocks[p] || [];
			helpers.config.debugLayout && console.log('block', p, this.blocks[p], things)
			things.push.apply( things, context.blocks[p] )
			this.blocks[p] = things;
		}

		for( p in context.appends ){
			things = this.appends[p] || [];
			things.push.apply( things, context.appends[p] )
			this.appends[p] = things;
		}

		for( p in context.prepends ){
			things = this.prepends[p] || [];
			things.push.apply( things, context.prepends[p] )
			this.prepends[p] = things;
		}

		for( p in context.blockMarks ){
			things = this.blockMarks[p] || [];
			things.push.apply( things, context.blockMarks[p] )
			this.blockMarks[p] = things;
			// rip marks and make them use THIS buffer, even ones already added
			this.blockMarks[p].forEach(function(mark){ mark.buffer = self.buffer; })
		}

		this.buffer.push( context.buffer.empty() );
	}

	helpers.ensureLayoutProperties = function(){
		this.blocks = this.blocks || {};
		this.appends = this.appends || {};
		this.prepends = this.prepends || {};

		this.blockMarks = this.blockMarks || {};

		if( !this.layoutHandlersBound ){
			var self = this;

			this._handleRenderEnd = this.handleRenderEnd.bind(this);

			this.on('endchildrender', function(childCtx){
				// unbind end render call if this is a child
				childCtx.off('endrender', childCtx._handleRenderEnd)
			});

			this.on('endrender', this._handleRenderEnd );
			this.layoutHandlersBound = true;
		}
	}

	helpers.handleRenderEnd = function(ctx){
		helpers.config.debugLayout && console.log('handleRenderEnd called', this.buffer.toString(), ctx.buffer.toString())
		var self = this, marks, injectMark, m, content, name, prepends, blocks, appends, block;

		// each time `.block` is called, a mark is added to the buffer and
		// the `blockMarks` stack. Find the newest/"highest" mark on the stack
		// for each named block, render the sub content, and insert it in place
		// of that mark
		for( var name in self.blockMarks ){
			marks = self.blockMarks[name];

			prepends = self.prepends[name];
			blocks = self.blocks[name];
			appends = self.appends[name];

			injectMark = marks.pop();

			if( helpers.config.debugLayout ){
				console.log( 'injecting at ', injectMark, 'into', self.buffer.__vo.join(',') )
				console.log( name, 'prepends', prepends )
				console.log( name, 'blocks', blocks )
				console.log( name, 'appends', appends )
			}

			// kill all references but the newest
			marks.forEach(function(m){
				helpers.config.debugLayout && console.log('destroying mark', m );
				m.destroy()
			})

			// get ready to grab the rendered block
			m = self.buffer.mark();

			// render
			prepends && prepends.forEach(function(a){ a(self.model); });
			helpers.config.debugLayout && console.log( 'looking at blocks', blocks, self.buffer.__vo );
			block = blocks.pop();
			if( block ){
				// a block may never have a callback defined, but it could
				// have appends/prepends
				block( self.model );
			}
			appends && appends.forEach(function(a){ a(self.model); });

			// kill all
			delete self.prepends[name];
			delete self.blocks[name];
			delete self.appends[name];

			// grab rendered content
			content = self.buffer.fromMark( m );

			// get ready for `apply`
			content.unshift( injectMark, 0 );

			if( helpers.config.debugLayout ){
				console.log( 'before apply', content )
				console.log( 'injectMark buffer', injectMark.buffer.__vo )
			}

			// inject rendered content in place of mark
			self.buffer.spliceMark.apply( self.buffer, content );
		}
	}

	helpers.extend = function(path, ctn){
		var  self = this
			,buffer = this.buffer
			,origModel = this.model
			,layoutCtx;

		this.ensureLayoutProperties();

		// this is a synchronous callback
		vash.loadFile(path, this.model, function(err, tpl){
			buffer.push( ctn(self.model) ); // the child content
			layoutCtx = tpl(self.model, { parentContext: self, asContext: true });
			helpers.config.debugLayout && console.log('layout buffer', layoutCtx.buffer.toString())
			self.consumeContext( layoutCtx );
		})

		this.model = origModel;
	}

	helpers.include = function(name, model){

		var  self = this
			,buffer = this.buffer
			,origModel = this.model
			,includeCtx

		this.ensureLayoutProperties();

		// this is a synchronous callback
		vash.loadFile(name, this.model, function(err, tpl){
			includeCtx = tpl(model || self.model, { parentContext: self, asContext: true })
			self.consumeContext( includeCtx );
		})

		this.model = origModel;
	}

	helpers.block = function(name, ctn){
		var bstart, ctnLines, self = this;

		this.ensureLayoutProperties();

		helpers.config.debugLayout && console.log('block called', this )

		var blockMarks = this.blockMarks[name] || (this.blockMarks[name] = []);

		blockMarks.push( this.buffer.mark() )

		if( !this.blocks[name] ){
			this.blocks[name] = [];
		}

		if( ctn ){
			this.blocks[name].push(ctn);
		}
	}

	helpers.append = function(name, ctn){
		this.ensureLayoutProperties();

		if( !this.appends[name] ){
			this.appends[name] = [];
		}

		this.appends[name].push(ctn);
	}

	helpers.prepend = function(name, ctn){
		this.ensureLayoutProperties();

		if( !this.prepends[name] ){
			this.prepends[name] = [];
		}

		this.prepends[name].push(ctn);
	}

	helpers.hasBlock = function(name){
		return typeof this.blocks[name] !== "undefined";
	}

	helpers.hasPrepends = function(name){
		return this.prepends[name] && (this.prepends[name].length > 0);
	}

	helpers.hasAppends = function(name){
		return this.appends[name] && (this.appends[name].length > 0);
	}

}());
