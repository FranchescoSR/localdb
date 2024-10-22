const Database = require('./utils/database'); // Importar la clase Database

// Crear una instancia de la base de datos
const db = new Database();

// Llamar al método para crear la base de datos con un nombre específico
const nombreBaseDatos = 'Eventos';
db.createDB(nombreBaseDatos)
  .then(mensaje => { console.log(mensaje); })
  .catch(error => { console.error(error); });


