env "local" {
  src = "file://schema.sql"
  dev = "sqlite://dev?mode=memory"
  migration {
    dir = "file://migrations"
  }
  url = "sqlite://../../apps/counter-sqlite-app/data/counter.db"
}
