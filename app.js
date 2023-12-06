#!/usr/bin/env node
const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const port = 13070;
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

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

const save_syms = (elfpath, outdir) => {
	const outpath = outdir+elfpath.split('/').pop();
	const elfProcess = spawn('./sym_reader/sym_reader', [elfpath,outpath]);
	elfProcess.on('close', (code) => {
		console.log(`child process exited with code ${code}`);
		assert (code === 0, 'sym_reader execution failure');
	});
	return outpath;
};

const initializeDatabase = () => {
	const createTableQuery = `
    CREATE TABLE IF NOT EXISTS libc (
      id INT AUTO_INCREMENT PRIMARY KEY,
      path VARCHAR(255) NOT NULL,
      md5sum VARCHAR(255) NOT NULL,
	  sympath VARCHAR(255) NOT NULL
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
	const outdir = __dirname+'/Libc_syms/'
	console.log('libcs in FS:',libcs);
	for(var i=0;i<libcs.length; i++){
		let path = libcs[i];
		md5sum(path)
			.then((md5sum) => {
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
						const outpath = save_syms(path,outdir);
						q = `INSERT INTO libc (path, md5sum, sympath) 
						VALUES ('${path}', '${md5sum}', '${outpath}')`;
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

const get_sym_obj = (filename) => {
    const f = fs.readFileSync(filename, {encoding:'utf8', flag:'r'});
    const lines = f.split('\x0a');
    lines.pop();
    let out = {};
    let tok;
    for(var i=0; i<lines.length; i++){
        tok = lines[i].split('|');
        out[tok[0]] = parseInt(tok[1],16);
    }
    return out;
};

const search_one = (tar_sym,tar_off,sym_obj) => {
    if (sym_obj[tar_sym] === undefined)
        return 0;
    if ((sym_obj[tar_sym]&0xfff) == (tar_off &0xfff))
        return 1;
	else 
		return 0;
};

const search = (query) => {
	return new Promise((resolve, reject) => {
		const q = 'SELECT * FROM libc';
		const keys = Object.keys(query);
		let ret = [];
		connection.query(q, (err,res) => {
			if (err){
				console.log('err: ',err);
				return ;
			}
			for (var i=0; i< res.length; i++){
				let sympath = res[i].sympath;
				let sym_obj = get_sym_obj(sympath);
				let flag = 1;
				for(var j=0; j<keys.length; j++)
					flag &= (search_one(keys[j], query[keys[j]], sym_obj));
				if (flag == 1)
					ret.push(res[i]);
			}
			resolve(ret);
		});
	});
		
};

const get_bin_sh = (filepath) => {
    return new Promise((resolve, reject) => {
        const proc = spawn('/usr/bin/strings', ['-tx',filepath]);
        let offset = 0;
        proc.stdout.on('data', (data)=> {
            const res = (data.toString('utf-8'));
            const idx = res.indexOf('/bin/sh');
            if (idx !== -1){
                offset = (parseInt(res.slice(idx-0x10,idx-1).split('\x20').pop(),16));
            }
        });
        proc.on('close', () => {
            if (offset !== 0)
                resolve(offset);
            else   
                resolve(-1);
        });
        proc.on('error', (error) => {
            reject(error);
        });
    });
};


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'Libc/');
    },
    filename: (req, file, cb) => {
        const fileName = file.originalname.toLowerCase().split(' ').join('-');
        cb(null, fileName);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
    	cb(null, true);
    }
});
const uploadDir = path.join(__dirname, '/Libc');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

app.use('/files',express.static(__dirname+'/Libc'));
app.use('/syms',express.static(__dirname+'/Libc_syms'));
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

const process = async (res, result) => {
	console.log(result);
	console.log('well processed');
	let txt = ''
	if (result.length == 0){
		txt = 'Not Found';
		res.json({ status: 'success', text: txt});
		return ;
	}
	txt = '';
	for(var i=0;i<result.length; i++){
		try { 
			let offset = await get_bin_sh(result[i].path);
			const filename = result[i].path.split('/').pop();
			const symfilename = result[i].sympath.split('/').pop();
			txt += `filename: <a href='/files/${filename}'>`+filename+ '</a><br>';	
			txt += 'md5sum: '+result[i].md5sum + '<br>';	
			txt += 'system: '+ '0x'+get_sym_obj(result[i].sympath)['system'].toString(16) + '<br>';
			txt += '/bin/sh: '+ '0x'+offset.toString(16) + '<br>';
			txt += `<a href='/syms/${symfilename}'>syms</a>`
			txt += '<br>';
		} catch (err) {
			console.log(err);
			return res.json({ status: 'error', text: 'Failed to get offset.'});
		}
	}
	res.json({ status: 'success', text: txt});
}

app.post('/api/get', (req, res) => {
	let rv = req.body;
	if (typeof(rv) !='object'){
		res.json({ status: 'error', text: 'Invalid JSON data.'});
		return ;
	}
	let keys = Object.keys(rv);
	for(var i=0; i< keys.length; i++){
		if(is_invalid(rv[keys[i]])){
			res.json({ status: 'error', text: 'Invalid Hex String.'});
			return ;
		}
		if (keys[i] !== '')
			rv[keys[i]] = parseInt(rv[keys[i]].toLowerCase(),16);
		else{
			delete rv[keys[i]];
		}
	}
	console.log(rv);

	search(rv)
		.then(result => {
			process(res, result);
		})
		.catch(error => {
			console.log(error);
			res.json({ status: 'success', text: 'Error Occured'});
		});
	
});

// app.get('/upload', (req, res) => {
//     res.sendFile(path.join(__dirname, './upload.html'));
// });

// app.post('/api/upload', upload.single('file'), (req, res) => {
//     res.json({ status: 'success', message: 'File uploaded successfully.' });
// });

app.listen(port,'0.0.0.0', () => {
	console.log(`Server listening at http://localhost:${port}`);
});
