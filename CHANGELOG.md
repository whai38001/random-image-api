# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2025-07-27

### 🐳 Docker & Deployment
- 🔧 修复Docker构建问题，使用`npm install --omit=dev`替代`npm ci --only=production`
- 🌐 简化docker-compose网络配置，移除子网设置以避免IP冲突
- 🔒 更新默认安全配置，生成安全的SESSION_SECRET密钥
- 📂 优化Docker多阶段构建，减小镜像体积

### ⚡ Performance & Security
- 🚀 添加图片缩略图系统，支持small/medium/large三种尺寸
- 🔒 增强安全配置，添加IP黑白名单和域名访问控制
- 🛡️ 实现维护模式，支持系统维护时的访问控制
- ⚡ 优化数据库索引，提升查询性能
- 📊 添加实时统计和监控功能

### 🎯 Features
- 👨‍💼 完整后台管理系统，支持图片上传、分类、批量操作
- 👥 用户管理系统，支持注册审批和权限控制
- 🛠️ 系统设置功能，可配置注册控制、用户限制等
- 🔍 搜索功能，支持关键词、分类、方向等多维度筛选
- 📈 统计分析，提供API调用统计和用户行为分析

### 🐛 Bug Fixes
- 📝 修复注册控制表单值重置问题
- 🔥 删除热门搜索功能中的默认标签显示
- 📁 修复缩略图生成和显示问题
- 🛠️ 修复系统配置加载和保存逻辑

## [1.0.0] - 2025-07-26

### 🎉 初始版本发布
- 🚀 基础随机图片API功能
- 🖼️ 支持多种图片分类（风景、动漫、美女等）
- 📱 响应式设计，支持PC和移动端
- 🔐 用户认证系统
- 📊 基础统计功能