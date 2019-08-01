all: k8sselection/js/index.js

k8sselection/js/index.js: js/*
	yarn install
	yarn run webpack

clean:
	rm -rf node_modules k8sselection/js