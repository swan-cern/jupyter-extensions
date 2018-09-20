
all: sparkmonitor/js/extension.js sparkmonitor/listener.jar

sparkmonitor/js/extension.js: js/*
	yarn install
	yarn run webpack

sparkmonitor/listener.jar: scalalistener/build.sbt scalalistener/CustomListener.scala
	rm -f sparkmonitor/listener.jar ; cd scalalistener ; sbt package

clean:
	rm -rf node_modules scalalistener/project scalalistener/target sparkmonitor/js sparkmonitor/listener.jar