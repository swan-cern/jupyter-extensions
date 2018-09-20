
all: swanhelp/js/extension.js

swanhelp/js/extension.js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules swanhelp/js