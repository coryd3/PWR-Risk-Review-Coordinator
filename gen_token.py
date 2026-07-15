from databricks.sdk import WorkspaceClient
import uuid
w = WorkspaceClient()
cred = w.database.generate_database_credential(
request_id=str(uuid.uuid4()),
instance_names=['databricks_postgres']
 )
print(cred.token_
