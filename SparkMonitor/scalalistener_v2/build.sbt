name := "sparkmonitor"

version := "1.0"

scalaVersion := "2.12.15"
crossScalaVersions := Seq("2.12.15", "2.13.5")

organization := "cern"

val sparkVersion3_212 = "3.2.0"
val sparkVersion3_213 = "3.2.0"

libraryDependencies ++= {
    List(
      "org.apache.spark" %% "spark-core" % sparkVersion3_212 ,
      "net.sf.py4j" % "py4j" % "0.10.9.2" ,
      "log4j" % "log4j" % "1.2.17" ,
    )
}

pluginCrossBuild / artifactPath in Compile in packageBin := {
  scalaBinaryVersion.value match {
    case "2.12" => (baseDirectory { base => base / ("../sparkmonitor/listenerv2_2.12.jar") }).value
    case "2.13" => (baseDirectory { base => base / ("../sparkmonitor/listenerv2_2.13.jar") }).value
  }
}
