import fs from 'fs';
import path from 'path';
import Query from './query'; // Importa la clase Query

class Database {
    constructor(directory = 'db') {
        this.directory = directory;
        this.dbName = null; // Base de datos cargada
        this.dbPath = null; // Ruta de la base de datos cargada

        if (!fs.existsSync(this.directory)) {
            fs.mkdirSync(this.directory, { recursive: true });
        }
    }

    // Método para crear un archivo de base de datos vacío (JSON)
    createDB(filename) {
        return new Promise((resolve, reject) => {
            this.dbName = filename;
            this.dbPath = path.join(this.directory, `${filename}.json`);

            if (fs.existsSync(this.dbPath)) {
                return resolve(`La base de datos ${filename} ya existe.`);
            }

            // Crear un archivo JSON vacío con la estructura inicial
            const initialData = { tablas: [] };

            fs.writeFile(this.dbPath, JSON.stringify(initialData, null, 2), 'utf8', (err) => {
                if (err) {
                    return reject(`Error al crear la base de datos: ${err}`);
                }
                resolve(`La base de datos ${filename} ha sido creada exitosamente.`);
            });
        });
    }

    // Método para cargar los datos de una base de datos existente
    load(filename) {
        return new Promise((resolve, reject) => {
            this.dbName = filename;
            this.dbPath = path.join(this.directory, `${filename}.json`);

            if (!fs.existsSync(this.dbPath)) {
                return reject(`La base de datos ${filename} no existe.`);
            }

            // Leer el archivo JSON y cargar su contenido
            fs.readFile(this.dbPath, 'utf8', (err, data) => {
                if (err) {
                    return reject(`Error al leer la base de datos: ${err}`);
                }
                resolve(JSON.parse(data)); // Cargar datos en formato JSON
            });
        });
    }

    // Método para crear una tabla dentro de la base de datos cargada
    createTable(tableName, structure = []) {
        return new Promise((resolve, reject) => {
            if (!this.dbName) return reject('No hay una base de datos cargada. Usa load(nombreDB) primero.');
    
            let dbContent = JSON.parse(fs.readFileSync(this.dbPath, 'utf8') || '{}');
    
            if (!dbContent.tablas) {
                dbContent.tablas = [];
            }
    
            const tableExists = dbContent.tablas.some(tabla => tabla[tableName]);
            if (tableExists) {
                return resolve(`La tabla ${tableName} ya existe.`);
            }
    
            const tableStructure = structure.includes('uid') ? structure : ['uid', ...structure];
    
            dbContent.tablas.push({
                [tableName]: {
                    cabecera: tableStructure,
                    datos: []
                }
            });
    
            fs.writeFileSync(this.dbPath, JSON.stringify(dbContent, null, 2), 'utf8');
            resolve(`Tabla ${tableName} creada en la base de datos ${this.dbName}.`);
        });
    } 

    // Metodo para seleccionar datos en una tabla
    table(tableName) {
        if (!this.dbName) throw new Error('No hay una base de datos cargada. Usa load(nombreDB) primero.');
        return new Query(tableName, this);
    }    
}

export default Database; 
