
all: swanintro/js/extension.js

swanintro/js/extension.js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules swanintro/js