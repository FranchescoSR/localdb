import fs from 'fs';

class Query {
    constructor(tableName, db) {
        this.tableName = tableName;
        this.db = db;
        this.filters = [];
        this.limite = null;
        this.order = null;
        this.selectedColumns = null;
    }

    where(column, value) {
        this.filters.push({ column, value });
        return this;
    }

    whereIn(column, values) {
        this.filters.push({ column, values, type: 'whereIn' });
        return this;
    }

    whereBetween(column, min, max) {
        this.filters.push({ column, min, max, type: 'whereBetween' });
        return this;
    }

    orderBy(column, direction = 'asc') {
        this.order = { column, direction };
        return this;
    }

    limit(n) {
        this.limite = n;
        return this;
    }

    select(...columns) {
        this.selectedColumns = columns;
        return this;
    }

    count() {
        return this.get().length;
    }

    find(uid) {
        return this.where('uid', uid).first();
    }

    first() {
        return this.get()[0] || null;
    }

    get() {
        if (!this.db.dbName) throw new Error('No hay una base de datos cargada. Usa load(nombreDB) primero.');

        let dbContent = JSON.parse(fs.readFileSync(this.db.dbPath, 'utf8') || '{}');

        const table = dbContent.tablas.find(tabla => tabla[this.tableName]);
        if (!table) throw new Error(`La tabla ${this.tableName} no existe.`);

        let results = table[this.tableName].datos;

        // Aplicar el join si es necesario
        if (this.joinTable) {
            const joinedTable = dbContent.tablas.find(tabla => tabla[this.joinTable]);
            if (!joinedTable) throw new Error(`La tabla ${this.joinTable} no existe.`);
            
            // Unir las tablas basadas en las claves
            results = results.map(row1 => {
                const matchedRows = joinedTable[this.joinTable].datos.filter(row2 => row1[this.foreignKey] === row2[this.primaryKey]);
                return matchedRows.map(row2 => {
                    return { ...row1, ...row2 }; // Combina los datos de ambas filas
                });
            }).flat(); // Aplanar el resultado en un solo arreglo
        }

        // Aplicar filtros where
        this.filters.forEach(({ column, value, values, min, max, type }) => {
            if (type === 'whereIn') {
                results = results.filter(row => values.includes(row[column]));
            } else if (type === 'whereBetween') {
                results = results.filter(row => row[column] >= min && row[column] <= max);
            } else {
                results = results.filter(row => row[column] === value);
            }
        });

        // Aplicar ordenamiento
        if (this.order) {
            const { column, direction } = this.order;
            results = results.sort((a, b) => {
                if (a[column] < b[column]) return direction === 'asc' ? -1 : 1;
                if (a[column] > b[column]) return direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        // Aplicar límite
        if (this.limite !== null) {
            results = results.slice(0, this.limite);
        }

        // Aplicar selección de columnas
        if (this.selectedColumns) {
            results = results.map(row => {
                let selectedRow = {};
                this.selectedColumns.forEach(col => {
                    if (row.hasOwnProperty(col)) {
                        selectedRow[col] = row[col];
                    }
                });
                return selectedRow;
            });
        }

        return results;
    }

    // Insertar un nuevo registro
    insert(data) {
        return new Promise(async (resolve, reject) => {
            let dbContent = JSON.parse(fs.readFileSync(this.db.dbPath, 'utf8') || '{}');
            const table = dbContent.tablas.find(tabla => tabla[this.tableName]);
            if (!table) return reject(`La tabla ${this.tableName} no existe.`);

            // Obtener el uid máximo de la tabla
            const maxUid = await this.getMaxUid();

            // Generar un nuevo uid
            const newUid = maxUid + 1;

            const newRecord = { uid: newUid, ...data };
            table[this.tableName].datos.push(newRecord);

            fs.writeFileSync(this.db.dbPath, JSON.stringify(dbContent, null, 2), 'utf8');
            resolve(newRecord);
        });
    }

    // Insertar un registro y devolver el ID generado
    insertGetId(data) {
        return this.insert(data).then(record => record.uid);
    }

    // Actualizar registros existentes
    update(data) {
        return new Promise((resolve, reject) => {
            let dbContent = JSON.parse(fs.readFileSync(this.db.dbPath, 'utf8') || '{}');
            const table = dbContent.tablas.find(tabla => tabla[this.tableName]);
            if (!table) return reject(`La tabla ${this.tableName} no existe.`);

            // Filtrar registros
            table[this.tableName].datos.forEach(row => {
                this.filters.forEach(({ column, value }) => {
                    if (row[column] === value) {
                        Object.assign(row, data);
                    }
                });
            });

            fs.writeFileSync(this.db.dbPath, JSON.stringify(dbContent, null, 2), 'utf8');
            resolve();
        });
    }

    // Eliminar registros
    delete() {
        return new Promise((resolve, reject) => {
            let dbContent = JSON.parse(fs.readFileSync(this.db.dbPath, 'utf8') || '{}');
            const table = dbContent.tablas.find(tabla => tabla[this.tableName]);
            if (!table) return reject(`La tabla ${this.tableName} no existe.`);

            // Filtrar registros
            table[this.tableName].datos = table[this.tableName].datos.filter(row => {
                return !this.filters.some(({ column, value }) => row[column] === value);
            });

            fs.writeFileSync(this.db.dbPath, JSON.stringify(dbContent, null, 2), 'utf8');
            resolve();
        });
    }

    // Vaciar la tabla (eliminar todos los registros)
    truncate() {
        return new Promise((resolve, reject) => {
            let dbContent = JSON.parse(fs.readFileSync(this.db.dbPath, 'utf8') || '{}');
            const table = dbContent.tablas.find(tabla => tabla[this.tableName]);
            if (!table) return reject(`La tabla ${this.tableName} no existe.`);

            // Vaciar los datos
            table[this.tableName].datos = [];

            fs.writeFileSync(this.db.dbPath, JSON.stringify(dbContent, null, 2), 'utf8');
            resolve();
        });
    }

    // Unir tablas
    join(tableName, foreignKey, primaryKey) {
        this.joinTable = tableName;
        this.foreignKey = foreignKey;
        this.primaryKey = primaryKey;
        return this; // Permite el encadenamiento
    }
    

    // Obtener el uid máximo
    getMaxUid() {
        return new Promise((resolve, reject) => {
            let dbContent = JSON.parse(fs.readFileSync(this.db.dbPath, 'utf8') || '{}');
            const table = dbContent.tablas.find(tabla => tabla[this.tableName]);
            if (!table) return reject(`La tabla ${this.tableName} no existe.`);

            const maxUid = table[this.tableName].datos.reduce((max, row) => {
                return row.uid > max ? row.uid : max;
            }, 0);

            resolve(maxUid);
        });
    }
}

export default Query; 
