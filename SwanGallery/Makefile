
all: swangallery/js/extension.js

swangallery/js/extension.js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules swangallery/js