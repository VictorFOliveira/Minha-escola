import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseImportFile } from "../../lib/imports";
import { renderExport } from "../../lib/admin-exports";

test("ExcelJS writes and reads XLSX with patched uuid dependency", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Alunos");
  sheet.addRow(["registration", "name", "email"]);
  sheet.addRow(["REG-001", "Aluno Teste", "aluno@example.invalid"]);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  assert.ok(buffer.length > 100);

  const parsed = await parseImportFile({
    type: "STUDENTS",
    name: "alunos.xlsx",
    buffer,
  });

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].registration, "REG-001");
  assert.equal(parsed[0].name, "Aluno Teste");
});

test("administrative XLSX export remains readable", async () => {
  const rendered = await renderExport(
    {
      title: "Teste",
      columns: ["Nome", "Valor"],
      rows: [
        ["Aluno", 100],
        ["Outro", 200],
      ],
    },
    "xlsx",
  );

  assert.equal(
    rendered.contentType,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    rendered.body as unknown as ExcelJS.Buffer,
  );

  const sheet = workbook.worksheets[0];
  assert.equal(sheet.getCell("A1").value, "Nome");
  assert.equal(sheet.getCell("A2").value, "Aluno");
  assert.equal(sheet.getCell("B3").value, 200);
});
