var mysql = require('mysql');

var movieCrawler = require('./imdb-crawler.js').movieCrawler;
var participationCrawler = require('./imdb-crawler.js').participationCrawler;
var crewCrawler = require('./imdb-crawler.js').crewCrawler;

// var sqlConn = mysql.createConnection({
var pool  = mysql.createPool({
	connectionLimit : 20,
	user: 'guest_demo',
	database: 'movies'
});

for (var i = 1; i < 10000; i++) {
	var c = new movieCrawler(i);
	c.requestMovieInfo.call(c, function () {
		c.parseData.call(c);
		var movieInsertSql = 'INSERT INTO movie (mID, title, year, poster_url) VALUES(?, ?, ?, ?);';
		pool.getConnection(function(err, sqlConn) {
			sqlConn.query(movieInsertSql, [c.movieID, c.movieData.title, c.movieData.year, c.movieData.poster], function (err, result) {
				console.info('will release sqlConn');
				sqlConn.release();
				if(err) {
					if(err.code == 'ER_DUP_ENTRY') {
						console.log('movie#'+c.movieID+' already exists');
						return;
					}
					throw err;
				} else {
					// if (result) console.log('result:'+result);
					console.log(c.movieID+' inserted!');
				}
			});
		});
		var genreInsertSql = 'INSERT INTO genre (mID, genre) VALUES(?, ?);';
		pool.getConnection(function(err, sqlConn) {
			var insertedOK = 0;
			for (var i = 0; i < c.movieData.genre.length; i++) {
				sqlConn.query(genreInsertSql, [c.movieID, c.movieData.genre[i]], function (err, result) {
					if(err) {
						if(err.code == 'ER_DUP_ENTRY') {
							console.log('movie#'+c.movieID+' genre#'+i+' already exists');
							return;
						}
						throw err;
					} else {
						console.log('movie#'+c.movieID+' genre#'+i+' inserted!');
						console.log('inserted genre: '+(++insertedOK));
						if(insertedOK >= c.movieData.genre.length) {
							console.info('will release sqlConn');
							sqlConn.release();
						}
					}
				});
			}
		});
	});
	
	// console.log("======new pc"+i);
	var pc = new participationCrawler(i);
	pc.requestParticipationInfo.call(pc, function () {
		// INSERT INTO participate (mID, cID, tID, role, credit_order) VALUES(472160, 564215, 3, 'Johnny / Max', 15);
		pc.parseData.call(pc);
		(function() {
			var pData = pc.participationData;
			for (var type in pData) {
				(function(type){
					// console.log(type+'========================');
					var typeArray = pData[type];
					// console.log(typeArray);

					// INSERT INTO crew (cID, name, profile_url) VALUES(564215, 'James McAvoy', 'http://ia.media-imdb.com/images/M/MV5BMTQzNzIxOTYzMl5BMl5BanBnXkFtZTcwNjYxNTk1Nw@@._V1_SY317_CR14,0,214,317_AL_.jpg');
					// this.crewID / this.crewData = {name: name, profile: profileSrc};
					var crewInsertSql = 'INSERT INTO crew (cID, name, profile_url) VALUES(?, ?, ?);';

					// INSERT INTO participate (mID, cID, tID, role, credit_order) VALUES(472160, 564215, 3, 'Johnny / Max', 15);
					var typeID;
					switch(type) {
						case 'direction': typeID = 1; break;
						case 'scenario': typeID = 2; break;
						case 'acting': typeID = 3; break;
						case 'music': typeID = 4; break;
						case 'cinematography': typeID = 5; break;
					}
					var pInsertSql = 'INSERT INTO participate (mID, cID, tID, role, credit_order) VALUES(?, ?, ?, ?, ?)';

					// !!!!!!!! 중요 !!!!!!!! 위에 getConnection 을 똥 같이 한 것 같다.
					pool.getConnection(function(err, sqlConn) {
						if(err) {
							console.log('pool connection error');
							throw err;
						}
						var insertedOK = 0;
						for (var i = 0; i < typeArray.length; i++) {
							(function(i){
								var crewID = typeArray[i].cID;
								var cc = new crewCrawler(crewID);
								var pRole = typeArray[i].role;
								var order = typeArray[i].creditOrder;
								cc.requestCrewInfo.call(cc, function () {
									cc.parseData.call(cc);
									console.log('crewID : '+cc.crewID);
									sqlConn.query(crewInsertSql, [cc.crewID, cc.crewData.name, cc.crewData.profile], function (err, result) {

										if(err) {
											if(err.code == 'ER_DUP_ENTRY') {
												console.log('crew#'+cc.crewID+' already exists');
												return;
											}
											console.log('error!!! crewID : '+cc.crewID);
											throw err;
										}
										console.log('crew#'+cc.crewID+' inserted!');
										sqlConn.query(pInsertSql, [cc.crewID, crewID, typeID, pRole, order], function (err, result) {
											if(err) {
												if(err.code == 'ER_DUP_ENTRY') {
													console.log('crew#'+cc.crewID+' already exists');
													return;
												}
												console.log('error!!! crewID : '+cc.crewID);
												throw err;
											}

											console.log('inserted crew: '+(++insertedOK));
											if(insertedOK >= typeArray.length) {
												console.info('will release sqlConn');
												sqlConn.release();
											}
										});
									});
								});
								// console.log(cc.crewData);
							})(i);
						}
					});
				})(type);
			}
			// console.log(pc.participationData);
		})();
	});
}