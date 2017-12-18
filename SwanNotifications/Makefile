
all: swannotifications/js

swannotifications/js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules swannotifications/js