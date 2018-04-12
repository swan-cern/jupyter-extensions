
all: sparkconnector/js

sparkconnector/js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules sparkconnector/js