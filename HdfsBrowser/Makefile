
all: hdfsbrowser/js/extension.js

hdfsbrowser/js/extension.js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules hdfsbrowser/js
