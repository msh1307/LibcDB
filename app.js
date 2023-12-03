const express = require('express');
const app = express();
const port = 13070;
const fs = require('fs');
const crypto = require('crypto');

function assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message || ''}`);
    }
}

let mysql = require('mysql2');
let connection = mysql.createConnection({
	host     : 'localhost',
	user     : 'root',
	password : 'p0o9i8u7!@',
	database : 'LIBCDB'
});
connection.connect((err) => {
	if (err) {
	  console.error('Error connecting to MySQL:', err);
	  return;
	}
	console.log('Connected to MySQL');
  	initializeDatabase();
});

const get_libc = () => {
	let files = fs.readdirSync(__dirname+'/Libc')
	assert (files !== undefined, 'err rd dir');
	for(var i=0;i<files.length; i++){
		files[i] = __dirname+'/Libc/'+files[i]
	}
	return files;
};

const md5sum = (filePath) => {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash('md5');
		const stream = fs.createReadStream(filePath);
  
		stream.on('data', (data) => {
			hash.update(data);
	 	});
  
	  	stream.on('end', () => {
			const md5sum = hash.digest('hex');
			resolve(md5sum);
	  	});
  
	  	stream.on('error', (error) => {
			reject(error);
	  	});
	});
};
  

const initializeDatabase = () => {
	const createTableQuery = `
    CREATE TABLE IF NOT EXISTS libc (
      id INT AUTO_INCREMENT PRIMARY KEY,
      path VARCHAR(255) NOT NULL,
      md5sum VARCHAR(255) NOT NULL
    )
	`;
	connection.query(createTableQuery, (err, res) => {
		if(err){
			console.log('err creating table: ',err);
			return; 
		}
	});
	let query = 'SELECT * FROM libc';
	connection.query(query, (err, res) => {
		if(err){
			console.log('err: ',err);
			return; 
		}
	});
	let libcs = get_libc();
	console.log('libcs in FS:',libcs);
	for(var i=0;i<libcs.length; i++){
		let path = libcs[i];
		md5sum(path)
			.then((md5sum) => {
				console.log('MD5 sum:', md5sum);
				let q = `SELECT * FROM libc WHERE md5sum = '${md5sum}'`;
				connection.query(q, (err,res) => {
					if (err){
						console.log('err: ',err);
						return;
					}
					console.log('libcs in DB:',res);
					if (res.length == 0){
						console.log('it\'s empty now');
						console.log(path);
						q = `INSERT INTO libc (path, md5sum) 
						VALUES ('${path}', '${md5sum}')`;
						connection.query(q, (err,res) => {
							if (err){
								console.log('err: ',err);
								return ;
							}
							console.log('successfully updated libc');
						})
					}
				})
			})
			.catch((error) => {
				console.error('Error calculating MD5:', error);
			});
	}
	
};


app.use('/css',express.static(__dirname+'/static/css'));
app.use('/images',express.static(__dirname+'/static/images'));
app.use('/js',express.static(__dirname+'/static/js'));
app.get('/', (req, res) => {
	fs.readFile('index.html', 'utf8', (err, data) => {
		if (err) {
			console.error('Error reading file:', err);
			return;
		}
		res.send(data);
	});
});

const is_invalid = (tar) =>{
	tar = tar.toLowerCase();
	const regex = /[^0123456789abcdef]/;
	return regex.test(tar);
};

app.use(express.json());
app.post('/api/get', (req, res) => {
	let rv = req.body;
	if (typeof(rv) !='object'){
		res.json({ status: 'error', message: 'Invalid JSON data.'});
		return ;
	}
	console.log(rv);
	let keys = Object.keys(rv);
	for(var i=0; i< keys.length; i++){
		if(is_invalid(rv[keys[i]])){
			res.json({ status: 'error', message: 'Invalid Hex string.', text: 'Invalid Hex String.'});
			return ;
		}
		rv[keys[i]] = parseInt(rv[keys[i]].toLowerCase(),16);
	}
	let txt = 'hi';
	res.json({ status: 'success', message: 'Received JSON data successfully.',text: txt});
});

app.listen(port,'0.0.0.0', () => {
	console.log(`Server listening at http://localhost:${port}`);
});
