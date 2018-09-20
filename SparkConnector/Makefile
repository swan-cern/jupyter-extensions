
all: sparkconnector/js/extension.js

sparkconnector/js/extension.js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules sparkconnector/js