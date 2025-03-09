const bcrypt = require("bcryptjs");

// Define the password you want to hash
const password = "Admin@123";  // Replace with your actual password

// Generate a salt and hash the password
bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, (err, hash) => {
        if (err) throw err;
        console.log("Hashed Password:", hash);
    });
});
