const express = require("express");
const fs = require("fs");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const mongoose = require("mongoose");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const { connectDb } = require("./config/db");
const BlogModal = require("./models/blogModel");
const UserModal = require("./models/userModal");
const PORT = 5500;

const app = express();
connectDb();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.set("view engine", "ejs");
app.use(express.static("upload"));

passport.use(
  new LocalStrategy({ usernameField: "email" }, async function (
    email,
    password,
    done
  ) {
    try {
      const user = await UserModal.findOne({ email: email });
      if (!user) {
        return done(null, false, { message: "Incorrect email." });
      }
      if (user.password !== password) {
        return done(null, false, { message: "Incorrect password." });
      }
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  UserModal.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./upload");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + file.originalname);
  },
});

const upload = multer({ storage: storage }).single("file");

const auth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/login");
  }
};

app.get("/", async (req, res) => {
  const blog = await BlogModal.find({});
  res.render("pages/index", { blogs: blog, user: req.user });
});

app.get("/add", auth, (req, res) => {
  res.render("pages/add", { user: req.user });
});

app.post("/add", async (req, res) => {
  upload(req, res, async function (err) {
    if (err) {
      console.error(err);
      return res.status(500).send("Error uploading file.");
    }
    if (req.file) {
      var details = {
        title: req.body.title,
        description: req.body.description,
        username: req.body.username,
        date: req.body.date,
        image: req.file.filename,
      };
      try {
        const blog = new BlogModal(details);
        await blog.save();
        res.redirect("/");
      } catch (error) {
        console.error(error);
        res.status(500).send("Error saving blog details.");
      }
    } else {
      res.status(400).send("No file uploaded.");
    }
  });
});

app.get("/signup", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/add");
  } else {
    res.render("pages/signup");
  }
});

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const user = new UserModal({ name, email, password });
  try {
    await user.save();
    res.redirect("/login");
  } catch (error) {
    res.redirect("/signup");
    console.log("Signup again");
  }
});

app.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/add");
  } else {
    res.render("pages/login");
  }
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/add",
    failureRedirect: "/login",
  })
);

app.get("/signout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.listen(PORT, () => {
  console.log(`Listening on port http://localhost:${PORT}`);
});
