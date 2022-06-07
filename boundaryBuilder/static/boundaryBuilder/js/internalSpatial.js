
// create global reference to worker performing source matching
var matchingWorker = null; 

//-----------------------------------
// this chunk defines boundary comparisons

// helpers
function geoj2turf(geoj) {
    let geom;
    if (geoj.type == 'Polygon') {
        geom = turf.polygon(geoj.coordinates)
    } else if (geoj.type == 'MultiPolygon') {
        geom = turf.multiPolygon(geoj.coordinates)
    };
    return geom;
};

function ol2turf(feat) {
    let geom = feat.getGeometry();
    let turfGeom;
    if (geom.getType() == 'Polygon') {
        turfGeom = turf.polygon(geom.getCoordinates());
    } else if (geom.getType() == 'MultiPolygon') {
        turfGeom = turf.multiPolygon(geom.getCoordinates());
    };
    //geom = turf.toWgs84(geom); // ol geom web mercator -> turf wgs84
    return turfGeom;
};

// feature to feature difference
function geomDifference(feat1, feat2) {
    let geom1 = ol2turf(feat1);
    //geom1 = turf.simplify(turf.cleanCoords(geom1), {tolerance:0.05, mutate:true})
    let geom2 = ol2turf(feat2);
    //geom2 = turf.simplify(turf.cleanCoords(geom2), {tolerance:0.05, mutate:true})
    let diff = turf.difference(geom1, geom2);
    return diff;
};

function geomIntersection(feat1, feat2) {
    // note, this currently receives openlayers feats, which are in mercator proj
    // this might impact the simplify+intersect... 
    let geom1 = ol2turf(feat1);
    geom1 = turf.simplify(geom1, {tolerance:0.001, mutate:true});
    //geom1 = turf.cleanCoords(geom1); //turf.simplify(turf.cleanCoords(geom1), {tolerance:0.01, mutate:true})
    let geom2 = ol2turf(feat2);
    geom2 = turf.simplify(geom2, {tolerance:0.001, mutate:true});
    //geom2 = turf.cleanCoords(geom2); //turf.simplify(turf.cleanCoords(geom2), {tolerance:0.01, mutate:true})
    let isec = turf.intersect(geom1, geom2);
    return isec;
};

// feature to feature similarity

function calcAllSpatialRelations(data1, data2, onProgress, onSuccess=null) {
    // calc relations from 1 to 2
    // calculate everything in background and receive results at end
    // to avoid locking up the entire gui

    // terminate any previous worker
    if (matchingWorker !== null) {
        matchingWorker.terminate();
    };

    // create worker
    matchingWorker = new Worker('static/boundaryBuilder/js/internalMatcherWorker.js');
    console.log(matchingWorker);
    
    // define how to process messages
    function processMessage(event) {
        let [status,data] = event.data;
        if (status == 'processed') {
            let [i,total,feat,matches] = data;
            if (onProgress) {
                onProgress(i, total, feat, matches);
            };
        } else if (status == 'finished') {
            console.log('finishing');
            if (onSuccess) {
                onSuccess();
            };
        };
    };
    matchingWorker.onmessage = processMessage;

    // tell worker to start processing
    matchingWorker.postMessage([data1, data2]);
};

function sortSpatialRelations(matches, sort_by, thresh, reverse=true) {
    // sort
    function sortFunc(a, b) {
        let trueVal;
        if (reverse == false) {
            trueVal = 1;
        } else {
            trueVal = -1;
        };
        if (a[1][sort_by] < b[1][sort_by]) {
            // a is less than b by some ordering criterion
            return -trueVal;
        };
        if (a[1][sort_by] > b[1][sort_by]) {
            // a is greater than b by the ordering criterion
            return trueVal;
        };
        // a must be equal to b
        return 0;
    };
    matches.sort(sortFunc);

    // filter by threshold
    let newMatches = [];
    for (let m of matches) {
        if (m[1][sort_by] >= thresh) {
            newMatches.push(m);
        };
    };

    return newMatches;
};

/*
function calcBestMatches(matches) {
    // this should output a simpler match list
    // with one row for every feat1
    // in the format feat,bestmatchfeat,stats
    // where multiple feats can't match to the same feat

    // helper to find features that match another
    function findFeaturesThatMatch(matchID) {
        result = [];
        for (x of matches) {
            var [feature,related] = x;
            related = sortSpatialRelations(related, 'equality', 0.01);
            if (related.length==0) {continue};
            for (y of related) {
                var [matchFeat,stats] = y;
                if (matchFeat.id == matchID) {
                    result.push([feature,stats]);
                };
            };
        };
        return result;
    };

    // create best match list
    var finalMatches = [];
    for (x of matches) {
        var [feature,related] = x;
        // match with highest equality
        related = sortSpatialRelations(related, 'equality', 0.01);
        if (related.length==0) {
            finalMatches.push([feature,null,null]);
            continue;
        };
        [bestMatchFeat,bestStats] = related[0];
        // make sure this match is the highest among all others
        // ie only the feature with the best match to another is allowed
        // ie multiple feats can't match another
        var othersThatMatch = findFeaturesThatMatch(bestMatchFeat.id);
        othersThatMatch = sortSpatialRelations(othersThatMatch, 'equality', 0.01);
        [bestOtherThatMatches,bestOtherThatMatchesStats] = othersThatMatch[0];
        if (feature.id == bestOtherThatMatches.id) {
            finalMatches.push([feature,bestMatchFeat,bestStats]);
        } else {
            finalMatches.push([feature,null,null]);
        };
    };

    // return
    return finalMatches;
};
*/


