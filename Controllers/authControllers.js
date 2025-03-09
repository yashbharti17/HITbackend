const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../Models/User");

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        console.log("🔍 Login Attempt:", email);

        const user = await User.findOne({ email });
        if (!user) {
            console.error("❌ User Not Found:", email);
            return res.status(400).json({ message: "User not found!" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.error("❌ Invalid Password for:", email);
            return res.status(400).json({ message: "Invalid credentials!" });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1m" });

        console.log("✅ Login Successful:", email);
        res.json({ token, message: "Login successful!" });

    } catch (err) {
        console.error("❌ Error in Login Controller:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
