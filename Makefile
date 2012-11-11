SRC = \
	support/exports.head.js \
	src/vlexer.js \
	src/vast.js \
	src/vparser.js \
	src/vcompiler.js \
	src/vexports.js \
	src/vruntime.js \
	src/vhelpers.js \
	src/vhelpers.layout.js \
	src/vexpress.js \
	support/exports.tail.js

LINTSRC = \
	src/vruntime.js \
	src/vhelpers.js \
	src/vhelpers.layout.js \
	src/vexpress.js \
	src/vlexer.js \
	src/vast.js \
	src/vparser.js \
	src/vcompiler.js

RUNTIMEREQSRC = \
	src/vruntime.js

RUNTIMEALLSRC = \
	src/vruntime.js \
	src/vhelpers.js \
	src/vhelpers.layout.js

UGLIFY = $(shell find node_modules -name "uglifyjs" -type f)
VOWS = $(shell find node_modules -name "vows" -type f)
JSHINT = $(shell find node_modules/jshint -name "hint" -type f)

LICENSE = @node support/tasks.js license
BUILDBUMP = @node support/tasks.js package.js
VERSION = @node support/tasks.js version

LICENSEHEADER = build/license.js

define \n

endef

build: $(SRC)
	$(BUILDBUMP) > /dev/null
	$(LICENSE) > $(LICENSEHEADER)
	@cat $(LICENSEHEADER) $^ > build/vash.js
	@cat $(LICENSEHEADER) $(RUNTIMEREQSRC) > build/vash-runtime.js
	@cat $(LICENSEHEADER) $(RUNTIMEALLSRC) > build/vash-runtime-all.js
	@rm $(LICENSEHEADER)
	$(VERSION); echo $(\n)

min: build
	@$(UGLIFY) build/vash.js > build/vash.min.js \
		&& du -h build/vash.js build/vash.min.js
	@$(UGLIFY) build/vash-runtime.js > build/vash-runtime.min.js \
		&& du -h build/vash-runtime.js build/vash-runtime.min.js
	@$(UGLIFY) build/vash-runtime-all.js > build/vash-runtime-all.min.js \
		&& du -h build/vash-runtime-all.js build/vash-runtime-all.min.js

test: build
	@$(VOWS) test/vash.test.js --spec

test-min: min
	@$(VOWS) test/vash.test.js --spec --whichv=build/vash.min.js

test-all: test test-min

lint:
	@$(JSHINT) $(LINTSRC)

clean:
	@rm build/*

.PHONY: build min test test-min lint clean