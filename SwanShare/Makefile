
all: swanshare/js/extension.js

swanshare/js/extension.js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules swanshare/js