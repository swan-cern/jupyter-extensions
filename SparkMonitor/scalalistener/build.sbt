name := "sparkmonitor"

version := "1.0"

scalaVersion := "2.11.12"
crossScalaVersions := Seq("2.11.12", "2.12.10")

organization := "cern"

val sparkVersion = "2.4.7"

libraryDependencies ++= List(
  "org.apache.spark" %% "spark-core" % sparkVersion,
  "net.sf.py4j" % "py4j" % "0.10.7",
  "log4j" % "log4j" % "1.2.17"
)

pluginCrossBuild / artifactPath in Compile in packageBin := {
  scalaBinaryVersion.value match {
    case "2.11" => (baseDirectory { base => base / ("../sparkmonitor/listener_2.11.jar") }).value
    case "2.12" => (baseDirectory { base => base / ("../sparkmonitor/listener_2.12.jar") }).value
  }
}
