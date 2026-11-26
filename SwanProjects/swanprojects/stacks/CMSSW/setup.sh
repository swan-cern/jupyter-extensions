#!/bin/bash
# This script allows to source CMSSW stack for a given release and platform.
# variables $RELEASE and $PLATFORM have to be exported before source this script by swan_env
CMS_BASEDIR=/cvmfs/cms.cern.ch
source $CMS_BASEDIR/cmsset_default.sh
CMSSW=$RELEASE
SCRAM=$PLATFORM

export PATH=${CMS_BASEDIR}/common:$PATH
cd $CMS_BASEDIR/$SCRAM/cms/cmssw/$CMSSW
eval `scramv1 runtime -sh`
#requires to prepend the lib and bin paths
export LD_LIBRARY_PATH=$CMS_BASEDIR/$SCRAM/cms/cmssw/$CMSSW/external/$SCRAM/lib/:$LD_LIBRARY_PATH
export PATH=$CMS_BASEDIR/$SCRAM/cms/cmssw/$CMSSW/external/$SCRAM/bin/:$PATH
