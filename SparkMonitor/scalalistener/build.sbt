name := "sparkmonitor"

version := "1.0"

//scalaVersion := 2.11.12 (note for Spark 2.4.7 and 3.0.1 on scala 2.12 use 2.12.10)
scalaVersion := sys.env("SCALA_VERSION")

organization := "cern"

// val sparkVersion = 2.4.7
val sparkVersion = sys.env("SPARK_VERSION")

libraryDependencies ++= List(
  "org.apache.spark" %% "spark-core" % sparkVersion,
  "net.sf.py4j" % "py4j" % "0.10.7",
  "log4j" % "log4j" % "1.2.17"
)
artifactPath in Compile in packageBin :=
   (baseDirectory { base => base / "../sparkmonitor/listener.jar" }).value
