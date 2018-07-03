
all: swangallery/js

swangallery/js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules swangallery/js