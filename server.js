import express from "express";
import cors from "cors";
import knex from "knex";
import bcrypt from "bcryptjs";

const db = knex({
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  },
});
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  db("users")
    .select("*")
    .then((users) => {
      res.json(users);
    });
});
app.get("/truncate", (req, res) => {
  db("users")
    .truncate()
    .then(() => console.log("Table truncated"))
    .catch((err) => console.error(err));
  db("login")
    .truncate()
    .then(() => {
      console.log("Login table truncated");
      res.json("Tables truncated successfully");
    });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db("login")
    .select("email", "hash")
    .where("email", email)
    .then((data) => {
      const isValid = bcrypt.compareSync(password, data[0].hash);
      if (isValid) {
        return db("users")
          .where("email", email)
          .then((user) => {
            res.json({ message: user[0].id, ok: true });
          })
          .catch((err) =>
            res.json({ message: "Unable to get user", ok: false })
          );
      } else {
        res.json({ message: "Wrong credentials", ok: false });
      }
    })
    .catch((err) => {
      res.json({ message: "Wrong credentials", ok: false });
    });
});

app.post("/register", (req, res) => {
  const { name, email, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  db.transaction((trx) => {
    return trx("login")
      .insert({
        email: email,
        hash: hash,
      })
      .returning("email")
      .then((loginEmail) => {
        return trx("users").returning("*").insert({
          name: name,
          email: loginEmail[0].email,
          joined: new Date(),
        });
      })
      .then((user) => {
        res.json({ message: user[0], ok: true });
      })
      .catch((err) => {
        console.log("failed");
        // trx.rollback();
        // console.error("erorr: ", err);
        console.error("Register error:", err.code);
        res.json({ message: "Email already exists", ok: false });
      });
  });
});

app.post("/profile", (req, res) => {
  const { id } = req.body;
  db("users")
    .where("id", id)
    .select("name", "entries")
    .then((data) => {
      console.log("data: ", data);
      res.send(
        data.length
          ? { entries: data[0].entries, name: data[0].name }
          : Error("User doesn't exist")
      );
    })
    .catch((err) => {
      console.error(err);
      res.json({ message: "Error getting user", ok: false });
    });
});

app.put("/image", (req, res) => {
  const { id } = req.body;
  db("users")
    .where("id", id)
    .returning("entries")
    .increment("entries", 1)
    .then((entries) => {
      res.json({ message: entries[0].entries, ok: false });
    })
    .catch((err) => {
      console.error(err);
      res.json({ message: "Error updating user", ok: false });
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server is running on port ", PORT);
});
