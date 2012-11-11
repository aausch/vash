var  semver = require('semver')
	,fs = require('fs')
	,program = require('commander')

var  pkgpath = __dirname + '/../package.json'
	,pkg = JSON.parse( fs.readFileSync(pkgpath, 'utf8') )
	,buildnum = semver.inc( pkg.version, 'build' )

program
	.command('package.js')
	.description('Increment the build number within package.json, write version to stdout')
	.action(function(){
		pkg.version = buildnum;
		fs.writeFileSync( pkgpath, JSON.stringify(pkg, null, '\t'), 'utf8' );
		process.stdout.write( buildnum );
	})

program
	.command('version')
	.description('Print the current version within package.json to stdout')
	.action(function(){
		process.stdout.write( buildnum );
	})

program
	.command('vash.version')
	.description('Write the current version from package.json to vash.version in src/vexports')
	.action(function(){
		var  vexportspath = __dirname + '/../src/vexports.js'
			,vexports = fs.readFileSync( vexportspath, 'utf8' );

		vexports = vexports.replace( /^(exports\["version"\] = ").+?(";)/, function( ma, c1, c2 ){
			return c1 + buildnum + c2;
		});

		fs.writeFileSync( vexportspath, vexports, 'utf8' );
	})

program
	.command('license')
	.description('Apply the current build number to the license file, write to stdout')
	.action(function(){
		var license = fs.readFileSync( __dirname + '/license.header.js', 'utf8' );
		license = license.replace('{{ version }}', buildnum);
		process.stdout.write( license );
	})

program.parse(process.argv);
