require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const cors = require('cors');
const streamifier = require('streamifier');
const mongoose = require('mongoose');

const authRoutes = require("./Routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer config (memory storage for buffer upload)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Google Drive Auth
const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets'  // Add this for Google Sheets access
  ];
  
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS, // Ensure your .env file has this path
    scopes: scopes
  }); 
const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });

// Job Schema
const jobSchema = new mongoose.Schema({
    jobId: String,
    positionTitle: String,
    jobClassification: String,
    experience: String,
    education: String,
    locationZip: String,
    organizationLevel: String,
    attitude: String,
    comments: String,
    jobDescription: String,
    certifications: [String],
    tools: [String],
    attachmentLinks: [String],
    datePosted: { 
        type: String, 
        default: () => new Date().toISOString().split('T')[0] // Stores only YYYY-MM-DD
    }
});

const Job = mongoose.model('Job', jobSchema);

// Debugging Request Logger
app.use((req, res, next) => {
    console.log(`🔍 Incoming Request: ${req.method} ${req.url}`);
    next();
});

// Routes
app.use("/api/auth", authRoutes);

// POST /api/jobs - Create Job with File Uploads
app.post('/api/jobs', upload.array('attachments'), async (req, res) => {
    try {
        const {
            jobId, positionTitle, jobClassification, experience,
            education, locationZip, organizationLevel, attitude,
            comments, jobDescription, certifications = [], tools = []
        } = req.body;

        const attachmentLinks = [];

        const folderId = '16E5IHs55NHydlC7qtNFRFcaI-ujvTV-i'; // Your Drive Folder ID

        // Handle files upload to Google Drive
        for (const file of req.files) {
            const fileMetadata = { name: file.originalname, parents: [folderId] };
            const media = { mimeType: file.mimetype, body: streamifier.createReadStream(file.buffer) };

            const { data } = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, webViewLink'
            });

            attachmentLinks.push(data.webViewLink);
        }

        const job = new Job({
            jobId,
            positionTitle,
            jobClassification,
            experience,
            education,
            locationZip,
            organizationLevel,
            attitude,
            comments,
            jobDescription,
            certifications: Array.isArray(certifications) ? certifications : [certifications],
            tools: Array.isArray(tools) ? tools : [tools],
            attachmentLinks,
            datePosted: new Date().toISOString().split('T')[0]
        });

        await job.save();

        res.status(201).json({ message: 'Job created successfully', jobId, attachmentLinks });
    } catch (err) {
        console.error('❌ Error creating job:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/getJobs - Fetch All Jobs
app.get('/api/getJobs', async (req, res) => {
    try {
        const jobs = await Job.find();
        res.status(200).json(jobs);
    } catch (err) {
        console.error('❌ Error fetching jobs:', err);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// GET /api/jobs/:jobId - Fetch Single Job by jobId (not _id)
app.get('/api/jobs/:id', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        res.status(200).json(job);
    } catch (err) {
        console.error('Error fetching job details:', err);
        res.status(500).json({ error: 'Failed to fetch job details' });
    }
});


// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log(`✅ Connected to Database: ${mongoose.connection.name}`);
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => console.error('❌ MongoDB Connection Error:', err));



// Candidate details submission


// schema

const candidateSchema = new mongoose.Schema({
    jobId: String,
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    education: String,
    experience: String,
    linkedin: String,
    address: String,
    totalScore: Number,
    skills: [String], 
    certifications: [String], 
    tools: [String], 
    resumeLink: String
});

const Candidate = mongoose.model('Candidate', candidateSchema);


// **POST /api/candidates - Submit Candidate Application**
app.post('/api/candidates', upload.single('resume'), async (req, res) => {
    try {
        const {
            jobId, firstName, lastName, email, phone, education, experience,
            linkedin, address, totalScore, skills=[], certifications = [], tools = []
        } = req.body;

        let resumeLink = null;
        const folderId = '16E5IHs55NHydlC7qtNFRFcaI-ujvTV-i';

        // **Upload Resume to Google Drive**
        if (req.file) {
            const fileMetadata = {
                name: `${firstName}_${lastName}_Resume.pdf`,
                parents: [folderId]
            };

            const media = {
                mimeType: req.file.mimetype,
                body: streamifier.createReadStream(req.file.buffer)
            };

            const uploadResponse = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, webViewLink'
            });

            resumeLink = uploadResponse.data.webViewLink;
        }

        // **Save Candidate to MongoDB**
        const candidate = new Candidate({
            jobId,
            firstName,
            lastName,
            email,
            phone,
            education,
            experience,
            linkedin,
            address,
            totalScore,
            skills: Array.isArray(skills) ? skills : [skills],
            certifications: Array.isArray(certifications) ? certifications : [certifications],
            tools: Array.isArray(tools) ? tools : [tools],
            resumeLink
        });

        await candidate.save();

        res.status(201).json({ message: 'Candidate applied successfully!', resumeLink });
    } catch (err) {
        console.error('❌ Error submitting candidate:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get("/api/candidates", async (req, res) => {
    try {
        const candidates = await Candidate.find().populate("jobId", "jobClassification"); // Populate job title
        res.json(candidates);
    } catch (error) {
        console.error("Error fetching candidates:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});




app.post('/api/candidateToSheet', async (req, res) => {
    const candidateDetails = req.body;
    const { candidateId, firstName, lastName, email, phone, education, experience, linkedin, address, totalScore, skills, certifications, tools } = candidateDetails;

    const values = [
        [
            candidateId || "Not Specified",
            firstName || "Not Specified",
            lastName || "Not Specified",
            email || "Not Specified",
            phone || "Not Specified",
            education || "Not Specified",
            experience || "Not Specified",
            linkedin || "Not Specified",
            address || "Not Specified",
            totalScore || "0",
            (Array.isArray(skills) ? skills.join(", ") : skills || "Not Specified"),
            (Array.isArray(certifications) ? certifications.join(", ") : certifications || "Not Specified"),
            (Array.isArray(tools) ? tools.join(", ") : tools || "Not Specified")
        ]
    ];

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: '1Ufx8chsZzW2SKYPc_AHueDwJI9B7G6xbzYhk8lJgF5Y',
            range: 'Sheet1!A1', // Adjust the sheet name and starting cell as needed
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });
        console.log('Data added to Google Sheet successfully');
        res.status(200).json({ message: 'Data added to Google Sheet successfully' });
    } catch (err) {
        console.error('Failed to append data to Google Sheet:', err);
        res.status(500).json({ message: 'Failed to submit the data in the google sheet' });
    }
});

app.post('/api/assessmentosheet', async (req, res) => {
    console.log(req.body);
    const candidateDetails = req.body;
    const {
        candidateId,
        agreeableness,
        communicationSkills,
        conscientiousness,
        criticalThinking,
        emotionalStability,
        extroversion,
        leadershipAbility,
        openness,
        professionalCultureProfile
    } = candidateDetails;


    const values = [
        [
            candidateId || "Not Specified",
            agreeableness || "Not Specified",
            communicationSkills || "Not Specified",
            conscientiousness || "Not Specified",
            criticalThinking || "Not Specified",
            emotionalStability || "Not Specified",
            extroversion || "Not Specified",
            leadershipAbility || "Not Specified",
            openness || "Not Specified",
            professionalCultureProfile || "Not Specified"
        ]
    ];

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: '1Ufx8chsZzW2SKYPc_AHueDwJI9B7G6xbzYhk8lJgF5Y',
            range: 'Sheet2', // Adjust the sheet name and starting cell as needed
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });
        console.log('Data added to Google Sheet successfully');
        res.status(200).json({ message: 'Data added to Google Sheet successfully' });
    } catch (err) {
        console.error('Failed to append data to Google Sheet:', err);
        res.status(500).json({ message: 'Failed to submit the data in the google sheet' });
    }
});
