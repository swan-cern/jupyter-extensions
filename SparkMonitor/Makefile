
all: sparkmonitor/js sparkmonitor/listener.jar

sparkmonitor/js: js/*
	yarn install
	yarn run webpack

sparkmonitor/listener.jar: scalalistener/build.sbt scalalistener/CustomListener.scala
	cd scalalistener ; sbt package

clean:
	rm -rf node_modules scalalistener/project scalalistener/target sparkmonitor/js sparkmonitor/listener.jar