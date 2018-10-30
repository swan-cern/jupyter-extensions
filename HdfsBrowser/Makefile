
all: hdfsbrowser/js

hdfsbrowser/js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules hdfsbrowser/js
