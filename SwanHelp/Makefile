
all: swanhelp/js

swanhelp/js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules swanhelp/js