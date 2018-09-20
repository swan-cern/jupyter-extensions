
all: swannotifications/js/extension.js

swannotifications/js/extension.js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules swannotifications/js