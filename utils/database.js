const fs = require('fs');

class Database {
    constructor() {
        this.filePath = './db/db.json';
        this.data = null;
        this.selectedTableName = null; // Guardar el nombre de la tabla seleccionada
        this.whereConditions = {}; // Almacenar condiciones de filtrado

        // Cargar los datos desde el archivo JSON al iniciar la clase
        this.load();
    }

    // Método para cargar datos desde el archivo
    load() {
        try {
            const data = fs.readFileSync(this.filePath, 'utf8');
            this.data = JSON.parse(data);
        } catch (error) {
            console.error(`Error al cargar la base de datos: ${error}`);
            this.data = { nombreDB: '', tablas: [] }; // Estructura vacía en caso de error
        }
    }

    // Método para guardar los datos en el archivo
    save() {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error(`Error al guardar la base de datos: ${error}`);
        }
    }

    // Método para crear la DB si no existe
    createDB(nombreDB) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(this.filePath)) {
                const dbData = {
                    nombreDB: nombreDB,
                    tablas: []
                };
                this.data = dbData;
                this.save();
                return resolve(`Archivo db.json creado con éxito con nombreDB: ${nombreDB}`);
            } else {
                return reject(`El archivo db.json ya existe.`);
            }
        });
    }

    // Método para seleccionar una tabla
    table(nombreTabla) {
        this.selectedTableName = nombreTabla; // Guardar el nombre de la tabla seleccionada
        this.whereConditions = {}; // Reiniciar las condiciones de filtrado
        return this; // Permitir encadenamiento
    }

    // Método para crear una nueva tabla
    create(campos) {
        return new Promise((resolve, reject) => {
            if (!this.selectedTableName) {
                return reject("No hay tabla seleccionada para crear.");
            }

            // Verificar si la tabla ya existe
            const tablaExistente = this.data.tablas.find(tabla => tabla[this.selectedTableName]);
            if (tablaExistente) {
                return resolve(`La tabla ${this.selectedTableName} ya existe.`);
            }

            // Asegurar que 'uid' esté en la cabecera
            const cabeceraConUid = ['uid', ...campos];

            // Crear la nueva tabla con los campos proporcionados
            const nuevaTabla = {
                [this.selectedTableName]: {
                    cabecera: cabeceraConUid,
                    datos: [] // Inicialmente vacío, se pueden agregar registros después
                }
            };

            this.data.tablas.push(nuevaTabla); // Agregar la nueva tabla
            this.save(); // Guardar cambios en el archivo

            resolve(`Tabla ${this.selectedTableName} creada con éxito.`);
        });
    }

    // Método para insertar datos en la tabla seleccionada
    insert(registro) {
        return new Promise((resolve, reject) => {
            if (!this.selectedTableName) {
                return reject('No hay tabla seleccionada para insertar.');
            }

            // Buscar la tabla seleccionada
            const tabla = this.data.tablas.find(tabla => tabla[this.selectedTableName]);

            if (!tabla) {
                return reject(`La tabla ${this.selectedTableName} no existe.`);
            }

            const tablaDatos = tabla[this.selectedTableName].datos;

            // Generar el nuevo uid
            const maxUid = tablaDatos.length > 0 ? Math.max(...tablaDatos.map(item => item.uid)) : 0;
            const nuevoUid = maxUid + 1; // Autoincrementar el uid

            // Completar los campos faltantes con null
            const nuevoRegistro = { uid: nuevoUid }; // Agregar el nuevo uid
            tabla[this.selectedTableName].cabecera.forEach(campo => {
                if (campo !== 'uid') { // No sobrescribir el uid
                    nuevoRegistro[campo] = registro[campo] !== undefined ? registro[campo] : null;
                }
            });

            // Insertar el nuevo registro
            tablaDatos.push(nuevoRegistro);
            this.save(); // Guardar cambios en el archivo

            resolve(`Registro insertado en la tabla ${this.selectedTableName} con éxito.`);
        });
    }

    // Método para agregar un nuevo campo a la cabecera y actualizar registros
    addFieldToTable(nuevoCampo) {
        return new Promise((resolve, reject) => {
            const tabla = this.data.tablas.find(tabla => tabla[this.selectedTableName]);
            if (!tabla) {
                return reject(`La tabla ${this.selectedTableName} no existe.`);
            }

            // Verificar si el campo ya existe en la cabecera
            if (tabla[this.selectedTableName].cabecera.includes(nuevoCampo)) {
                return reject(`El campo ${nuevoCampo} ya existe en la cabecera de la tabla ${this.selectedTableName}.`);
            }

            // Agregar el nuevo campo a la cabecera
            tabla[this.selectedTableName].cabecera.push(nuevoCampo);

            // Actualizar cada registro para incluir el nuevo campo con valor null
            tabla[this.selectedTableName].datos.forEach(registro => {
                registro[nuevoCampo] = null;
            });

            this.save(); // Guardar cambios en el archivo

            resolve(`Campo ${nuevoCampo} agregado a la cabecera de la tabla ${this.selectedTableName} y actualizado en los registros.`);
        });
    }

    // Método para eliminar un campo de la cabecera y de los datos de la tabla
    removeFieldFromTable(campoAEliminar) {
        return new Promise((resolve, reject) => {
            const tabla = this.data.tablas.find(tabla => tabla[this.selectedTableName]);
            if (!tabla) {
                return reject(`La tabla ${this.selectedTableName} no existe.`);
            }

            // Verificar si el campo existe en la cabecera
            const index = tabla[this.selectedTableName].cabecera.indexOf(campoAEliminar);
            if (index === -1) {
                return reject(`El campo ${campoAEliminar} no existe en la cabecera de la tabla ${this.selectedTableName}.`);
            }

            // Eliminar el campo de la cabecera
            tabla[this.selectedTableName].cabecera.splice(index, 1);

            // Eliminar el campo de cada registro
            tabla[this.selectedTableName].datos.forEach(registro => {
                delete registro[campoAEliminar];
            });

            this.save(); // Guardar cambios en el archivo

            resolve(`Campo ${campoAEliminar} eliminado de la cabecera y de los datos de la tabla ${this.selectedTableName}.`);
        });
    }

    // Método para actualizar campos en los registros de la tabla
    update(nuevosDatos) {
        return new Promise((resolve, reject) => {
            if (!this.selectedTableName) {
                return reject('No hay tabla seleccionada para actualizar.');
            }

            // Buscar la tabla seleccionada
            const tabla = this.data.tablas.find(tabla => tabla[this.selectedTableName]);

            if (!tabla) {
                return reject(`La tabla ${this.selectedTableName} no existe.`);
            }

            const tablaDatos = tabla[this.selectedTableName].datos;

            // Filtrar los registros que coincidan con las condiciones de "where"
            const registrosFiltrados = tablaDatos.filter(registro => {
                return Object.entries(this.whereConditions).every(([campo, valor]) => {
                    return registro[campo] === valor;
                });
            });

            // Actualizar los registros filtrados con los nuevos datos
            registrosFiltrados.forEach(registro => {
                Object.entries(nuevosDatos).forEach(([campo, valor]) => {
                    registro[campo] = valor; // Actualizar el campo
                });
            });

            this.save(); // Guardar cambios en el archivo

            if (registrosFiltrados.length > 0) {
                resolve(`${registrosFiltrados.length} registros actualizados en la tabla ${this.selectedTableName} con éxito.`);
            } else {
                resolve('No se encontraron registros que actualizar.');
            }
        });
    }

    // Método para eliminar registros de la tabla según condiciones
    delete() {
        return new Promise((resolve, reject) => {
            if (!this.selectedTableName) {
                return reject('No hay tabla seleccionada para eliminar.');
            }

            // Buscar la tabla seleccionada
            const tabla = this.data.tablas.find(tabla => tabla[this.selectedTableName]);

            if (!tabla) {
                return reject(`La tabla ${this.selectedTableName} no existe.`);
            }

            const tablaDatos = tabla[this.selectedTableName].datos;

            // Filtrar los registros que coincidan con las condiciones de "where"
            const registrosFiltrados = tablaDatos.filter(registro => {
                return Object.entries(this.whereConditions).every(([campo, valor]) => {
                    return registro[campo] === valor;
                });
            });

            // Eliminar los registros filtrados de la tabla
            const registrosRestantes = tablaDatos.filter(registro => {
                return !registrosFiltrados.includes(registro);
            });

            tabla[this.selectedTableName].datos = registrosRestantes; // Actualizar datos

            this.save(); // Guardar cambios en el archivo

            if (registrosFiltrados.length > 0) {
                resolve(`${registrosFiltrados.length} registros eliminados de la tabla ${this.selectedTableName} con éxito.`);
            } else {
                resolve('No se encontraron registros que eliminar.');
            }
        }).then(result => {
            this.whereConditions = {}; // Resetear condiciones después de la eliminación
            return result;
        });
    }


    // Método para establecer las condiciones de filtrado (where)
    where(conditions) {
        this.whereConditions = conditions; // Guardar condiciones para el update
        return this; // Permitir encadenamiento
    }

    // Método para obtener y filtrar los registros de la tabla
    filter(...conditions) {
        const tabla = this.data.tablas.find(tabla => tabla[this.selectedTableName]);
        if (!tabla) {
            throw new Error(`La tabla ${this.selectedTableName} no existe.`);
        }

        const registros = tabla[this.selectedTableName].datos;

        // Filtrar registros según las condiciones
        const resultadosFiltrados = registros.filter(registro => {
            return conditions.every(condition => {
                const [campo, valor] = condition;
                return registro[campo] === valor;
            });
        });

        return {
            resultados: resultadosFiltrados,
            // Método para ordenar los resultados
            orderBy: (campo, orden = 'asc') => {
                return resultadosFiltrados.sort((a, b) => {
                    if (a[campo] < b[campo]) return orden === 'asc' ? -1 : 1;
                    if (a[campo] > b[campo]) return orden === 'asc' ? 1 : -1;
                    return 0;
                });
            }
        };
    }
}

module.exports = Database;
