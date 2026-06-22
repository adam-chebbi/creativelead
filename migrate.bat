@echo off
echo Running initial Prisma migration...
cd api
call npx prisma migrate dev --name init
echo Done!
pause
